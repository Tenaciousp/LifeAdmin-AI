import subprocess,time,json,hashlib,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
out=root/'replica'/'friday-20261124';out.mkdir(exist_ok=True)
repo=root.parent
files=subprocess.check_output(['git','ls-files','-co','--exclude-standard','-z'],cwd=repo).decode().split('\0')
files=sorted(set(f for f in files if f and not any(x in f.split('/') for x in ['node_modules','__pycache__','data','replica','dist','dist-local'])))
hashes={f:hashlib.sha256((repo/f).read_bytes()).hexdigest() for f in files if (repo/f).is_file()}
identity=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()
(out/'source-fingerprint.json').write_text(json.dumps({'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo).decode().strip(),'branch':subprocess.check_output(['git','branch','--show-current'],cwd=repo).decode().strip(),'fingerprint':identity,'files':hashes},indent=2))
commands=[('offline',['node','--test']+[str(p.relative_to(root)) for p in sorted((root/'artifacts/adminpilot-ai/src/lib/offline').glob('*.test.mjs'))]),('api',['npm','test']),('typechecks',['npm','run','typecheck']),('normal-production',['npm','run','build:web']),('local-customer',['npm','run','build:local']),('local-bundle',['node','scripts/verify_local_bundle.mjs']),('broadband-states',['node','scripts/qa_bill_help.cjs','--local-state'])]
results=[]
for name,cmd in commands:
 t=time.monotonic()
 with (out/(name+'.log')).open('w') as log:
  result=subprocess.run(cmd,cwd=root,stdout=log,stderr=subprocess.STDOUT,env={**__import__('os').environ,'TZ':'Europe/London','CUSTOMER_KEY_AI_ENABLED':'false','GEMINI_DRAFTS_ENABLED':'false','GEMINI_LIVE_COMPARISONS_ENABLED':'false'})
 results.append({'name':name,'exit_code':result.returncode,'elapsed_seconds':round(time.monotonic()-t,3)})
 (out/'results.json').write_text(json.dumps({'fingerprint':identity,'checks':results},indent=2))
 print(results[-1],flush=True)
 if result.returncode: break
changed=[f for f,h in hashes.items() if not (repo/f).is_file() or hashlib.sha256((repo/f).read_bytes()).hexdigest()!=h]
(out/'snapshot-stability.json').write_text(json.dumps({'changed_during_checks':changed},indent=2))
