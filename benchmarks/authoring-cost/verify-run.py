#!/usr/bin/env python3
"""Common machine and capture checks on frozen output; never assert semantic pass."""
import argparse, hashlib, json, os, pathlib, subprocess, time

def hashfile(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--run-dir',type=pathlib.Path,required=True);ap.add_argument('--workspace',type=pathlib.Path,required=True);ap.add_argument('--common-skill',type=pathlib.Path,required=True);a=ap.parse_args()
 summary=a.run_dir/'summary.json'
 if not summary.exists():raise SystemExit('Author must be terminal before independent verification')
 output=a.run_dir/'machine-review'
 if output.exists():raise SystemExit('Review exists; keep original evidence rather than overwrite')
 output.mkdir();cli=a.common_skill/'bin/archify.mjs';node='/opt/homebrew/opt/node@22/bin/node'
 env=dict(os.environ,ARCHIFY_CHROME=str(a.workspace/'chrome-wrapper'),TMPDIR=str(a.workspace/'tmp'))
 rows=[];t0=time.monotonic();before={p.name:hashfile(p) for p in [a.workspace/'candidate.json',a.workspace/'diagram.html'] if p.exists()}
 def run(name,args):
  st=time.monotonic();p=subprocess.run([node,str(cli),*map(str,args)],cwd=a.workspace,env=env,capture_output=True,text=True,timeout=90)
  (output/(name+'.stdout.txt')).write_text(p.stdout);(output/(name+'.stderr.txt')).write_text(p.stderr)
  row={'name':name,'exit_code':p.returncode,'duration_ms':1000*(time.monotonic()-st),'command':[node,str(cli),*map(str,args)],'status':'passed' if p.returncode==0 else 'failed'};rows.append(row);return p.returncode
 candidate=a.workspace/'candidate.json';artifact=a.workspace/'diagram.html';source=a.workspace/'source'
 if candidate.exists():run('common-final-validate',['validate','architecture',candidate,'--repo-root',source,'--quality','showcase','--json'])
 if artifact.exists():
  checked=run('common-final-check',['check',artifact,'--require-provenance'])
  if checked==0:
   run('common-final-browser',['browser-check',artifact,'--require-provenance','--out-dir',output/'final-browser','--json'])
   run('common-final-captures',['visual-check',artifact,'--require-provenance','--out-dir',output/'final-visual','--json'])
 snapshots=a.run_dir/'candidate-snapshots.jsonl'
 # Every snapshot is retained; select the observer's first structural complete.
 index=[json.loads(line) for line in snapshots.read_text().splitlines() if line.strip()] if snapshots.exists() else []
 if isinstance(index,dict):index=index.get('snapshots',index.get('candidates',[]))
 first=next((x for x in index if x.get('complete')),None)
 if first:
  files=sorted((a.run_dir/'candidate-snapshots').glob('*.json'))
  snap=next((p for p in files if hashfile(p)==first['sha256']),None)
  if snap:
   valid=run('common-first-validate',['validate','architecture',snap,'--repo-root',source,'--quality','showcase','--json'])
   if valid==0:
    html=output/'first.html'
    delivered=run('common-first-deliver',['deliver','architecture',snap,html,'--repo-root',source,'--quality','showcase','--json'])
    if delivered==0:run('common-first-captures',['visual-check',html,'--require-provenance','--out-dir',output/'first-visual','--json'])
 after={name:hashfile(a.workspace/name) for name in before}
 report={'status':'machine_checked; semantic and perceptual review pending','checks':rows,'duration_ms':1000*(time.monotonic()-t0),'author_bytes_unchanged':before==after,'frozen_hashes':before,'first_snapshot':first,'common_skill':str(a.common_skill),'warning':'Common B checks supplement each variant native gate; images must actually be inspected. First snapshot audit cost is separate from final acceptance.'}
 (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'checks':len(rows),'author_bytes_unchanged':before==after,'output':str(output)}))
if __name__=='__main__':main()
