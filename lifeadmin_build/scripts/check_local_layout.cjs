// Optional browser QA dependency, kept outside the application dependency graph:
// npm install --prefix /tmp/lifeadmin-browser-qa playwright@1.56.1
// /tmp/lifeadmin-browser-qa/node_modules/.bin/playwright install chromium --only-shell
// NODE_PATH=/tmp/lifeadmin-browser-qa/node_modules node scripts/check_local_layout.cjs [public-directory] [evidence-directory]
const {chromium} = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '../artifacts/adminpilot-ai/dist-local/public'));
  const output = path.resolve(process.argv[3] || path.join(require('node:os').tmpdir(), 'lifeadmin-layout-evidence'));
  fs.mkdirSync(output,{recursive:true});
  assert(fs.existsSync(path.join(root,'index.html')),'Build local customer assets first');
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + '/')) {res.writeHead(403).end(); return;}
    const target = file.endsWith('/') ? path.join(file, 'index.html') : file;
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).on('error', () => res.writeHead(404).end()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({headless:true});
    const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
    const requests = [], external = [], errors = [];
    context.on('request', req => {requests.push({url:req.url(),method:req.method(),type:req.resourceType()});});
    await context.route('**/*', route => {
      const url = route.request().url();
      if (new URL(url).origin !== origin) {external.push(url); return route.abort();}
      return route.continue();
    });
    const page = await context.newPage();
    page.on('dialog', dialog => dialog.accept());
    page.on('websocket', socket => external.push(socket.url()));
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(origin + '/');
    const button = name => page.getByRole('button',{name,exact:true});
    const heading = name => page.getByRole('heading',{name,exact:true});
    const prepare = async () => {
      await button('Prepare comparison question').click();
      await heading('Your AI question is ready').waitFor();
    };
    await button('Water').click();
    await page.getByLabel('What would you like help with?').selectOption('check_bill');
    await page.getByLabel('Bill name',{exact:true}).fill('Network QA synthetic bill');
    await page.getByLabel('Water company (useful)',{exact:true}).fill('Example Water');
    await page.getByLabel('Country / region of this bill').selectOption('Canada');
    await page.getByLabel('Bill currency').selectOption('CAD');
    await page.locator('summary').filter({hasText:'More bill details (optional)'}).click();
    await page.locator('#amount').fill('46.00');
    await page.getByLabel('Customer reference (optional)',{exact:true}).fill('SYNTHETIC-NETWORK-QA-7319');
    await button('Save bill and continue to AI help').click();
    await heading('Check your bill details').waitFor();
    await prepare();
    const prompt = page.getByLabel('Prepared AI request',{exact:true});
    const reviewed = await prompt.inputValue();
    assert(reviewed.length > 100);
    assert.match(reviewed,/46\.00/);
    assert.doesNotMatch(reviewed,/SYNTHETIC-NETWORK-QA-7319/);
    assert.equal(await prompt.evaluate(element => element.readOnly),true);
    await button('Copy question').click();
    await page.getByRole('status').filter({hasText:'Question copied and progress saved.'}).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()),reviewed);
    const layouts = [];
    for (const width of [320,375,768,1024]) {
      await page.setViewportSize({width,height:1024});
      for (const scale of [1,2]) {
        await page.evaluate(scale => {document.documentElement.style.fontSize = `${16*scale}px`;},scale);
        await page.getByRole('heading',{name:'Your AI question is ready',exact:true}).scrollIntoViewIfNeeded();
        const layout = await page.evaluate(() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,fontSize:getComputedStyle(document.documentElement).fontSize,clippedControls:[...document.querySelectorAll('button,input,select,textarea,a')].filter(e => e.getBoundingClientRect().width && (e.getBoundingClientRect().left < -1 || e.getBoundingClientRect().right > innerWidth+1)).map(e=>({name:e.textContent.trim().slice(0,60),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
        layouts.push({...layout,scale,screen:'guided question'});
        await page.screenshot({path:path.join(output,`layout-${width}-${scale}.png`)});
      }
    }
    console.log('Layout checks:',JSON.stringify(layouts));
    if (layouts.some(layout => layout.scrollWidth > layout.width + 1)) {
      await page.setViewportSize({width:320,height:1024});
      await page.evaluate(() => {document.documentElement.style.fontSize='32px';});
      const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].map(element => {
        const rect = element.getBoundingClientRect();
        return {tag:element.tagName.toLowerCase(),className:typeof element.className === 'string' ? element.className.slice(0,100) : '',text:(element.textContent || '').trim().slice(0,60),left:Math.round(rect.left),right:Math.round(rect.right)};
      }).filter(item => item.right > innerWidth + 1 || item.left < -1).slice(0,20));
      console.log('Overflow candidates:',JSON.stringify(overflow));
    }
    await page.setViewportSize({width:768,height:1024});
    await page.evaluate(() => {document.documentElement.style.fontSize='32px';document.activeElement.blur();window.scrollTo(0,0);});
    // Begin before the first focusable element, then traverse the full document.
    await page.evaluate(() => {document.body.tabIndex=-1;document.body.focus();});
    const tabStops=[];
    for (let i=0;i<240;i++) {
      await page.keyboard.press('Tab');
      await page.waitForFunction(() => {const e=document.activeElement,r=e.getBoundingClientRect();return e===document.body || (r.bottom>0 && r.top<innerHeight);},{},{timeout:3000});
      const focused=await page.evaluate(() => {const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,name:(e.getAttribute('aria-label')||e.textContent||e.id).trim().slice(0,80),href:e.getAttribute('href'),top:r.top,bottom:r.bottom,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,tabIndex:e.tabIndex};});
      if(focused.tag==='BODY') break;
      tabStops.push(focused);
    }
    console.log('Keyboard stops:',tabStops.length);
    for (const layout of layouts) {
      assert(layout.scrollWidth<=layout.width+1,JSON.stringify(layout));
      assert.deepEqual(layout.clippedControls,[],JSON.stringify(layout));
    }
    for (const name of ['Copy question','Close bill help','Open Copilot (Microsoft, free option)','Manage backups','App privacy policy']) {
      assert(tabStops.some(stop=>stop.name===name),`Tab traversal missed ${name}`);
    }
    assert(tabStops.every(stop=>stop.outlineStyle!=='none'&&parseFloat(stop.outlineWidth)>0),'A keyboard focus indicator is missing');
    // The chosen-service UI intentionally displays one launch link at a time.
    // Verify every provider by selecting each option instead of counting five
    // simultaneously visible links from the older all-links layout.
    const aiLinks=[];
    const aiSelector=page.getByRole('combobox',{name:/^AI service/});
    for (const [id,name,url] of [['chatgpt','ChatGPT','https://chatgpt.com/'],['gemini','Gemini','https://gemini.google.com/'],['copilot','Copilot','https://copilot.microsoft.com/'],['claude','Claude','https://claude.ai/new'],['perplexity','Perplexity','https://www.perplexity.ai/']]) {
      await button('Change details').click();
      await aiSelector.selectOption(id);
      await prepare();
      const link=await page.getByRole('link',{name:new RegExp('^Open '+name)}).evaluate(e=>({name:e.textContent,href:e.getAttribute('href'),target:e.target,rel:e.rel}));
      assert.equal(link.href,url);assert.equal(new URL(link.href).search,'');assert.equal(new URL(link.href).hash,'');assert.equal(link.target,'_blank');assert(link.rel.includes('noopener')&&link.rel.includes('noreferrer'));
      aiLinks.push(link);
    }
    assert.equal(aiLinks.length,5);
    await button('I have an answer to review').click();
    await heading('Paste and review your AI answer').waitFor();
    await page.getByLabel('Answer from your AI',{exact:true}).fill([
      '## Best next action','Ask the water company to check the meter reading.',
      '## Alternatives to consider','Compare metering or repayment options, not suppliers.',
      '## Estimated savings','Not available: no verified prices.',
      '## Editable provider email','Subject: Please check my water bill',
      'Message: Please explain the current bill.'
    ].join('\n'));
    await page.getByRole('checkbox',{name:/^I have checked the answer/}).check();
    await button('Save reviewed result').click();
    const resultHeading = page.getByRole('heading', {name:'Network QA synthetic bill · Plan',exact:true,level:2});
    await resultHeading.waitFor();
    for (const width of [320,375,768,1024]) {
      await page.setViewportSize({width,height:1024});
      for (const scale of [1,2]) {
        await page.evaluate(scale => {document.documentElement.style.fontSize = `${16*scale}px`;},scale);
        const title = await page.locator('#saved-plans li h3').filter({hasText:'Network QA synthetic bill'}).boundingBox();
        assert(title && title.width >= Math.min(180,width*0.4),`Saved plan title is squeezed at ${width}px / ${scale*100}% text`);
        const controls=await Promise.all([button('Copy plan'),button('Copy message'),page.getByRole('link',{name:'Open email app',exact:true})].map(control=>control.boundingBox()));
        for(let i=0;i<controls.length;i++) {
          const current=controls[i], previous=controls[i-1];
          assert(current && current.x >= -1 && current.x + current.width <= width + 1,'Plan actions must be visible and not clipped');
          if(previous && Math.abs(previous.y-current.y)<2) assert(current.x-(previous.x+previous.width)>=8,`Plan action gap is below 8 px at ${width}px / ${scale*100}% text`);
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),`Saved result overflow at ${width}px / ${scale*100}% text`);
        await resultHeading.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`saved-result-${width}-${scale}.png`)});
      }
    }
    assert(requests.every(request=>new URL(request.url).origin===origin && ['GET','HEAD'].includes(request.method)), 'Browser must not send the bill or prompt');
    assert.deepEqual(external,[]);
    assert.deepEqual(errors,[]);
    const usabilityReport={scope:'Browser fallback with 100%/200% root font sizes; not native Apple Dynamic Type, VoiceOver, hardware keyboard, actual external navigation or WKWebView acceptance',passed:true,layouts,tabStops,aiLinks,pageErrors:errors};
    fs.writeFileSync(path.join(output,'usability-result.json'),JSON.stringify(usabilityReport,null,2)+'\n');
    console.log(JSON.stringify(usabilityReport,null,2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error);process.exitCode=1;});

