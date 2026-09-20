#!/usr/bin/env python3
"""Build redacted all-attempt tables and a dependency-free local timeline."""
import argparse, csv, html, json, pathlib, statistics

def read(path, default=None):
    try:return json.loads(path.read_text())
    except FileNotFoundError:return default

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--manifest',type=pathlib.Path,required=True)
    ap.add_argument('--evidence',type=pathlib.Path,required=True);ap.add_argument('--output',type=pathlib.Path,required=True)
    a=ap.parse_args();m=read(a.manifest);a.output.mkdir(parents=True,exist_ok=True);rows=[];timeline=[]
    for spec in m['runs']:
        folder=a.evidence/spec['run_id'];s=read(folder/'summary.json');q=read(folder/'quality.json',{})
        if s is None:continue
        wall=s.get('execution_wall_ms',s.get('total_wall_ms'));first=s.get('pre_first_complete_ms');passed=q.get('status')=='passed'
        row={'run_id':spec['run_id'],'case_id':spec['case_id'],'variant':spec['variant'],
             'cohort':s.get('cohort'),'execution_status':s.get('status'),'quality_status':q.get('status','not_evaluated'),
             'first_quality_status':q.get('first_candidate',{}).get('status','not_evaluated'),
             'author_wall_ms':wall,'first_complete_ms':first,
             'post_json_ms':wall-first if wall is not None and first is not None else None,
             'final_review_ms':q.get('review_duration_ms'),
             'accepted_total_ms':wall+q['review_duration_ms'] if passed and wall is not None and q.get('review_duration_ms') is not None else None,
             'candidate_versions':s.get('candidate_count'),'repair_edits':q.get('repair_edits'),
             'command_count':s.get('command_interval_count'),'tool_union_ms':s.get('command_union_ms'),
             'tool_accumulated_ms':s.get('command_accumulated_ms'),'tool_overlap_ms':s.get('command_overlap_ms'),
             'model_rounds':s.get('model_rounds'),'same_file_reads':q.get('same_file_reads'),
             'same_range_reads':q.get('same_range_reads'),'git_calls':q.get('git_calls'),
             'browser_ms':q.get('browser_ms'),'input_tokens':(s.get('usage') or {}).get('input_tokens'),
             'output_tokens':(s.get('usage') or {}).get('output_tokens'),'cached_input_tokens':(s.get('usage') or {}).get('cached_input_tokens'),
             'reasoning_output_tokens':(s.get('usage') or {}).get('reasoning_output_tokens'),'cost':None}
        rows.append(row)
        spans=[]
        if (folder/'spans.jsonl').exists():
            spans=[json.loads(x) for x in (folder/'spans.jsonl').read_text().splitlines() if x.strip()]
        timeline.append({'run':row,'spans':spans,'start':s.get('observer_start_utc')})
    (a.output/'runs.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    if rows:
        with (a.output/'runs.csv').open('w') as f:
            w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
    groups=[]
    for case in m['tasks']:
        for variant in m['variants']:
            rr=[r for r in rows if r['case_id']==case['id'] and r['variant']==variant]
            if not rr:continue
            times=[r['accepted_total_ms'] for r in rr if r['accepted_total_ms'] is not None]
            groups.append({'case_id':case['id'],'variant':variant,'attempts':len(rr),
               'final_pass':sum(r['quality_status']=='passed' for r in rr),
               'first_pass':sum(r['first_quality_status']=='passed' for r in rr),
               'quality_pending':sum(r['quality_status']=='not_evaluated' for r in rr),
               'timeouts':sum(r['execution_status']=='timeout' for r in rr),
               'successful_accepted_median_ms':statistics.median(times) if times else None,
               'successful_accepted_range_ms':[min(times),max(times)] if times else None})
    comparisons=[]
    for case in m['tasks']:
        by={g['variant']:g for g in groups if g['case_id']==case['id']}
        for baseline in ['A','B']:
            c=by.get('C',{}).get('successful_accepted_median_ms');b=by.get(baseline,{}).get('successful_accepted_median_ms')
            comparisons.append({'case_id':case['id'],'comparison':'C/'+baseline,
              'successful_only_difference_ms':c-b if c is not None and b is not None else None,
              'successful_only_change_percent':100*(c/b-1) if c is not None and b else None,
              'limitation':'Conditional on acceptance; see all-attempt pass/failure counts. No quality noninferiority claim.'})
    (a.output/'stage-summary.json').write_text(json.dumps({'groups':groups,'comparisons':comparisons,'registered_attempts':len(m['runs']),'observed_attempts':len(rows),'weights':'equal per task; no pooled difficulty-weighted latency'},ensure_ascii=False,indent=2)+'\n')
    payload=json.dumps(timeline,ensure_ascii=False).replace('<','\\u003c')
    page='''<!doctype html><meta charset="utf-8"><title>Archify authoring timeline</title>
<style>body{font:15px system-ui;margin:30px;max-width:1400px;background:#f7f8fa;color:#16202a}select{padding:8px;width:70%}pre{white-space:pre-wrap;background:white;padding:16px}#chart{background:white;padding:16px}.row{display:grid;grid-template-columns:190px 1fr;gap:12px;margin:8px 0}.rail{position:relative;height:24px;background:#edf0f4}.bar{position:absolute;height:22px;background:#287dc0;min-width:2px;border-radius:3px}small{color:#536170}</style>
<h1>Authoring event timeline</h1><p>Monotonic observer intervals; native CLI receipt timings are separate. Blank space is unclassified host/model wait, not measured reasoning. Overlapping bars are concurrent and must not be added to wall time.</p>
<select id="pick"></select><pre id="summary"></pre><div id="chart"></div><pre id="detail">Select a bar for its observed command.</pre><script>
const runs=PAYLOAD;const pick=document.querySelector('#pick');
runs.forEach((x,i)=>{let o=document.createElement('option');o.value=i;o.textContent=x.run.run_id+' · '+x.run.quality_status;pick.append(o)});
function draw(){const x=runs[pick.value];if(!x)return;document.querySelector('#summary').textContent=JSON.stringify(x.run,null,2);const chart=document.querySelector('#chart');chart.replaceChildren();const spans=x.spans.filter(s=>s.start&&s.end);const first=x.start?Date.parse(x.start):Math.min(...spans.map(s=>Date.parse(s.start)));const last=first+(x.run.author_wall_ms||Math.max(...spans.map(s=>Date.parse(s.end)))-first);const total=Math.max(1,last-first);for(const s of spans){const row=document.createElement('div');row.className='row';const label=document.createElement('small');label.textContent=(s.phase||'unclassified')+' · '+(s.duration_ms??'?')+' ms';const rail=document.createElement('div');rail.className='rail';const bar=document.createElement('button');bar.className='bar';bar.style.left=100*(Date.parse(s.start)-first)/total+'%';bar.style.width=100*(Date.parse(s.end)-Date.parse(s.start))/total+'%';bar.title=s.command||s.event||'';bar.onclick=()=>document.querySelector('#detail').textContent=JSON.stringify(s,null,2);rail.append(bar);row.append(label,rail);chart.append(row)}}pick.onchange=draw;draw();</script>'''.replace('PAYLOAD',payload)
    (a.output/'timeline.html').write_text(page)
    print(json.dumps({'attempts':len(rows),'output':str(a.output)}))
if __name__=='__main__':main()
