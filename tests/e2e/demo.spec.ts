import { expect, test } from '@playwright/test';

test('demo workspace exposes health, repair, editor, visual lab, export', async ({ page }) => {
  test.skip(process.env.ENABLE_PUBLIC_DEMO !== 'true', 'Enable demo and start Python processor for full test');
  await page.goto('/demo');
  await expect(page.getByText(/messy-sales.csv/i).first()).toBeVisible();
  for (const name of ['Data health', 'Repairs', 'Data editor', 'Charts', 'Exports']) {
    await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
  }
});

test('row lookups preserve pagination and chart selection through Next.js', async ({ request }) => {
  test.skip(process.env.ENABLE_PUBLIC_DEMO !== 'true', 'Requires demo and processor');
  const rows = async (selection: object) => {
    const response = await request.post('/api/demo/process', {
      data: {action:'rows', csv:'name,value\nA,1\nB,2\nC,3\n', ...selection},
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  const page = await rows({offset:1,limit:1});
  expect(page.total).toBe(3);
  expect(page.rows).toMatchObject([{name:'B'}]);
  const selected = await rows({rowIds:[page.rows[0].__rv_row_id]});
  expect(selected.total).toBe(1);
  expect(selected.rows).toEqual(page.rows);
});

test('decision analysis compares scenarios and inspects the exact influential row', async ({page}) => {
  test.skip(process.env.ENABLE_PUBLIC_DEMO !== 'true', 'Requires demo and processor');
  await page.goto('/demo');
  await page.getByRole('button',{name:'Decision analysis',exact:true}).first().click();
  await page.getByRole('combobox',{name:'Metric',exact:true}).selectOption('revenue');
  await page.getByRole('combobox',{name:'Group by',exact:true}).selectOption('region');
  await page.getByRole('button',{name:'Run simulation'}).click();
  await expect(page.getByRole('heading',{name:'Ranking stability'})).toBeVisible();
  await page.getByRole('combobox',{name:'With',exact:true}).selectOption('2');
  await expect(page.locator('.js-plotly-plot')).toBeVisible({timeout:15000});
  const inspect = page.getByRole('button',{name:/Inspect row .* in Data Editor/}).first();
  const row = (await inspect.innerText()).match(/row (\d+)/)![1];
  await inspect.click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.data-table tbody tr td').first()).toHaveText(row);
  await page.getByRole('button',{name:'Show all rows'}).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(13);
});

test('comparison date labels stay clear of the legend at desktop and phone widths', async ({page}) => {
  test.skip(process.env.ENABLE_PUBLIC_DEMO !== 'true', 'Requires demo and processor');
  const points=Array.from({length:20},(_,i)=>({x:`2026-06-${String(i+1).padStart(2,'0')}`,y:20-i,rank:i+1,rowIds:[]}));
  await page.route('**/api/demo/process',async route=>{
    if(route.request().postDataJSON()?.action!=='decision')return route.continue();
    await route.fulfill({json:{status:'Stable',reason:'Ranks agree.',assumptions:[],critical:{examined:0,count:0,rows:[]},
      scenarios:['Original upload','Current version'].map(name=>({name,eligible:20,groups:20,winners:[points[0].x],winnerCount:1,points}))}});
  });
  await page.goto('/demo');
  await page.getByRole('button',{name:'Decision analysis',exact:true}).first().click();
  await page.getByRole('button',{name:'Run simulation'}).click();
  const chart=page.locator('.decision-comparison');
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:850});
    await expect(chart.locator('.xtick text')).toHaveCount(20,{timeout:15000});
    await expect.poll(()=>chart.evaluate(figure=>{
      const host=figure.querySelector('.workspace-plot')!.getBoundingClientRect();
      const legend=figure.querySelector('.legend')!.getBoundingClientRect();
      const scroll=figure.querySelector('.comparison-scroll')!.getBoundingClientRect();
      return scroll.right<=window.innerWidth && Array.from(figure.querySelectorAll('.xtick text')).every(text=>{
        const box=text.getBoundingClientRect();
        return box.top>=legend.bottom && box.bottom<=host.bottom && box.left>=host.left && box.right<=host.right;
      });
    })).toBe(true);
  }
});
