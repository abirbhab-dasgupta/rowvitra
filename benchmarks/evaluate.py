"""Transparent synthetic-corruption smoke benchmark. Not a public-data accuracy claim.

Run: PYTHONPATH=services/processor python benchmarks/evaluate.py
Replace with licensed clean public datasets and held-out corruptions for a judged benchmark.
"""
import json
import time
from pathlib import Path
from rowvitra.engine import parse_csv, get_profile, preview

CASES = [
 {"id":"category_case", "clean":"id,region,revenue\n001,North,100\n002,North,150\n003,South,200\n", "corrupt":"id,region,revenue\n001,North,100\n002,NORTH,150\n003,South,200\n", "expected":"inconsistent_category", "operations":[{"operation":"normalize_category","column":"region"}]},
 {"id":"duplicate_row", "clean":"id,region,revenue\n001,North,100\n002,South,150\n003,West,200\n", "corrupt":"id,region,revenue\n001,North,100\n002,South,150\n003,West,200\n003,West,200\n", "expected":"exact_duplicate", "operations":[{"operation":"drop_duplicates"}]},
 {"id":"missing_value", "clean":"id,region,revenue\n001,North,100\n002,South,150\n003,West,200\n", "corrupt":"id,region,revenue\n001,North,100\n002,South,\n003,West,200\n", "expected":"missing", "operations":[]},
 {"id":"mixed_numeric", "clean":"id,region,revenue\n001,North,100\n002,South,150\n003,West,200\n", "corrupt":"id,region,revenue\n001,North,100\n002,South,unknown_value\n003,West,200\n", "expected":"mixed_types", "operations":[]},
 {"id":"negative_age", "clean":"id,age,score\n001,19,80\n002,21,90\n003,20,75\n", "corrupt":"id,age,score\n001,19,80\n002,-5,90\n003,20,75\n", "expected":"negative_value", "operations":[]},
]

def run():
    results=[]
    for case in CASES:
        start=time.perf_counter()
        profile=get_profile(parse_csv(case['corrupt']))
        detected=any(issue['kind']==case['expected'] for issue in profile['issues'])
        attempted=bool(case['operations'])
        correctly_repaired=False
        unexpected_edits=0
        if attempted:
            output=preview(parse_csv(case['corrupt']),case['operations'])
            correctly_repaired = output['csv']==case['clean']
            # For these labeled synthetic cases, a correct exact-output match proves no good cells changed.
            unexpected_edits = 0 if correctly_repaired else output['diff']['totalCellChanges']
        results.append({"case":case['id'],"expectedIssue":case['expected'],"detected":detected,"repairAttempted":attempted,"repairCorrect":correctly_repaired if attempted else None,"healthyCellDamageUpperBound":unexpected_edits if attempted else None,"elapsedMs":round((time.perf_counter()-start)*1000,2)})
    summary={"datasetOrigin":"five synthetic seeded fixtures, not public datasets", "aiEvaluated":False, "detected":sum(r['detected'] for r in results), "total":len(results), "attemptedRepairs":sum(r['repairAttempted'] for r in results), "correctRepairs":sum(r['repairCorrect'] is True for r in results), "abstained":sum(not r['repairAttempted'] for r in results), "cases":results}
    path=Path(__file__).with_name('synthetic_results.json')
    path.write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary,indent=2))
if __name__=='__main__': run()
