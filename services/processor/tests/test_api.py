import os
os.environ["PROCESSOR_SERVICE_TOKEN"] = "test-only-token"
from fastapi.testclient import TestClient
from rowvitra.main import app

client=TestClient(app)
CSV="id,region,sales\n001,North,30\n002,NORTH,50\n"
HEADERS={"X-Processor-Token":"test-only-token"}

def test_health():
    assert client.get('/health').json()['status']=='ok'

def test_no_auth():
    assert client.post('/v1/profile',json={'csv':CSV}).status_code==401

def test_profile():
    r=client.post('/v1/profile',headers=HEADERS,json={'csv':CSV,'goal':'sales by region'})
    assert r.status_code==200 and r.json()['rowCount']==2

def test_suggest_fallback():
    r=client.post('/v1/suggest',headers=HEADERS,json={'csv':CSV})
    assert r.status_code==200 and r.json()['mode']=='rules'
    assert r.json()['proposals'][0]['operation']['operation']=='normalize_category'

def test_preview_and_chart():
    r=client.post('/v1/preview',headers=HEADERS,json={'csv':CSV,'operations':[{'operation':'normalize_category','column':'region'}]})
    assert r.status_code==200 and r.json()['diff']['totalCellChanges']==1
    q=client.post('/v1/chart',headers=HEADERS,json={'csv':CSV,'spec':{'type':'bar','x':'region','y':'sales','aggregation':'sum'}})
    assert q.status_code==200 and len(q.json()['points'])==2

def test_script():
    r=client.post('/v1/script',headers=HEADERS,json={'csv':CSV,'operations':[{'operation':'trim','column':'region'}]})
    assert r.status_code==200 and 'pd.read_csv' in r.json()['script']

def test_large_csv_rejected():
    r=client.post('/v1/profile',headers=HEADERS,json={'csv':'x\n'+'a\n'*12000})
    assert r.status_code==422

def test_chart_advisor_fallback():
    r=client.post('/v1/chart-advisor',headers=HEADERS,json={'csv':CSV,'goal':'sales by region'})
    assert r.status_code==200 and r.json()['spec']['x']=='region'

def test_row_selection():
    r=client.post('/v1/rows',headers=HEADERS,json={'csv':CSV,'rowIds':['2']})
    assert r.status_code==200 and r.json()['rows'][0]['id']=='002'

def test_script_replay_verified_api():
    r=client.post('/v1/script',headers=HEADERS,json={'csv':CSV,'operations':[{'operation':'trim','column':'region'}]})
    assert r.status_code==200 and r.json()['replayVerified'] is True

def test_impact_chart_before_after():
    r=client.post('/v1/impact-chart',headers=HEADERS,json={'csv':CSV,'operations':[{'operation':'normalize_category','column':'region'}], 'spec':{'type':'bar','x':'region','y':'sales','aggregation':'sum'}})
    assert r.status_code==200
    assert len(r.json()['before']['points'])==2
    assert len(r.json()['after']['points'])==1
    assert r.json()['after']['points'][0]['y']==80

def test_invalid_nested_chart_filter_returns_422():
    r=client.post('/v1/chart',headers=HEADERS,json={'csv':CSV,'spec':{'type':'bar','x':'region','filters':[None]}})
    assert r.status_code==422

def test_cumulative_recipe_over_one_batch_exports_and_replays():
    operations=[{'operation':'trim','column':'region'} for _ in range(30)]+[{'operation':'checkpoint'}]
    script=client.post('/v1/script',headers=HEADERS,json={'csv':CSV,'operations':operations})
    assert script.status_code==200 and script.json()['replayVerified'] is True
    replay=client.post('/v1/replay',headers=HEADERS,json={'csv':CSV,'newCsv':CSV,'operations':operations})
    assert replay.status_code==200 and replay.json()['canPreview'] is True
    batch=client.post('/v1/preview',headers=HEADERS,json={'csv':CSV,'operations':operations})
    assert batch.status_code==422
