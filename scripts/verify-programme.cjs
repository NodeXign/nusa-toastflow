// Read-only backend verification + browser-generated September & November sheets, .docx & offline HTML checks.
// PLAYWRIGHT_MODULE may point to a bundled runtime; default uses installed playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const people = require('./people.js');
const roles = require('./recommend.js');
const root = path.resolve(__dirname, '..');
const source = require('../data/september-2026-final.json');
const visitingPool = require('../data/visiting-toastmasters.json');
const output = path.join(root,'output/pdf');
const scratch = path.join(root,'tmp/pdfs');
const base = process.env.TOASTFLOW_BASE_URL || 'http://127.0.0.1:8765/';

function readZipEntries(filePath){
  const buf=fs.readFileSync(filePath);
  let eocd=-1;
  for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--){
    if(buf.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  }
  assert.ok(eocd>=0,'Invalid ZIP EOCD: '+filePath);
  const cdCount=buf.readUInt16LE(eocd+10);
  let ptr=buf.readUInt32LE(eocd+16);
  const entries={};
  for(let i=0;i<cdCount;i++){
    assert.equal(buf.readUInt32LE(ptr),0x02014b50,'Invalid central directory header');
    const method=buf.readUInt16LE(ptr+10);
    const compSize=buf.readUInt32LE(ptr+20);
    const nameLen=buf.readUInt16LE(ptr+28);
    const extraLen=buf.readUInt16LE(ptr+30);
    const commentLen=buf.readUInt16LE(ptr+32);
    const lfhOff=buf.readUInt32LE(ptr+42);
    const name=buf.slice(ptr+46,ptr+46+nameLen).toString('utf8');
    ptr+=46+nameLen+extraLen+commentLen;
    assert.equal(buf.readUInt32LE(lfhOff),0x04034b50,'Invalid local file header');
    const lNameLen=buf.readUInt16LE(lfhOff+26);
    const lExtraLen=buf.readUInt16LE(lfhOff+28);
    const dataStart=lfhOff+30+lNameLen+lExtraLen;
    const raw=buf.slice(dataStart,dataStart+compSize);
    entries[name]=method===8?zlib.inflateRawSync(raw):raw;
  }
  return entries;
}

function verifyDocx(filePath,expectContains,expectNotContains,minMediaCount=8){
  const entries=readZipEntries(filePath);
  for(const req of ['[Content_Types].xml','_rels/.rels','word/_rels/document.xml.rels','word/document.xml']){
    assert.ok(entries[req],`Missing ${req} in ${filePath}`);
  }
  const mediaKeys=Object.keys(entries).filter(k=>/^word\/media\/img\d+\.(png|jpg|gif)$/i.test(k));
  assert.ok(mediaKeys.length>=minMediaCount,`Expected >= ${minMediaCount} embedded images in ${filePath}, got ${mediaKeys.length}`);
  for(const mk of mediaKeys){
    const bytes=entries[mk];
    assert.ok(bytes.length>100,`Image ${mk} is too small (${bytes.length} bytes)`);
    if(/\.png$/i.test(mk)){
      assert.ok(bytes.slice(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),`${mk} is not a valid PNG`);
    }
  }
  const docXml=entries['word/document.xml'].toString('utf8');
  const relsXml=entries['word/_rels/document.xml.rels'].toString('utf8');
  for(const mk of mediaKeys){
    const relTarget=mk.replace(/^word\//,'');
    assert.ok(relsXml.includes(`Target="${relTarget}"`),`Missing relationship for ${relTarget}`);
  }
  const embeds=[...docXml.matchAll(/r:embed="(rId\d+)"/g)].map(m=>m[1]);
  assert.ok(embeds.length>=minMediaCount,`Expected >= ${minMediaCount} image drawings in document.xml, got ${embeds.length}`);
  for(const rid of embeds){
    assert.ok(relsXml.includes(`Id="${rid}"`),`Dangling r:embed ${rid}`);
  }
  assert.ok(!docXml.includes('DontDisplayPageBoundaries'));
  assert.ok(!/<w:tblPr>(?:(?!<\/w:tblPr>).)*<w:tcBorders>/.test(docXml),'Invalid tcBorders inside tblPr');
  for(const s of expectContains)assert.ok(docXml.includes(s),`Expected "${s}" in ${filePath}`);
  for(const s of expectNotContains)assert.ok(!docXml.includes(s),`Did not expect "${s}" in ${filePath}`);
  return {mediaCount:mediaKeys.length,size:fs.statSync(filePath).size};
}

async function assertAllSheetImagesLoaded(targetPage,label){
  const report=await targetPage.evaluate(()=>{
    const imgs=[...document.querySelectorAll('.sheet img')].filter(im=>!im.hidden&&getComputedStyle(im).display!=='none');
    return imgs.map(im=>({
      alt:im.alt||im.id||'',
      complete:im.complete,
      w:im.naturalWidth,
      h:im.naturalHeight,
      isData:/^data:image\//i.test(im.getAttribute('src')||im.src||'')
    }));
  });
  assert.equal(report.length,8,`${label}: expected 8 visible images, got ${report.length}`);
  for(const im of report){
    assert.ok(im.complete&&im.w>0&&im.h>0,`${label}: image "${im.alt}" failed to load (${im.w}x${im.h})`);
    assert.ok(im.isData,`${label}: image "${im.alt}" is not embedded as data URI`);
  }
  return report;
}

(async()=>{
  for(const f of ['index.html','programming-sheet.html','templates/NUSA-Programming-Sheet-template.html']) {
    for(const m of fs.readFileSync(path.join(root,f),'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
  }
  assert.equal(people.canonical('Jiaqi Xu'),'XU Jiaqi');
  assert.equal(people.label('Shuching?'),'GOH Shu Ching, PM5, EH3');
  assert.notEqual(people.canonical('Sandy W. Goh'),people.canonical('Shu Ching Goh'));
  assert.notEqual(people.canonical('Vincent CHUA'),people.canonical('Vincent CHEN'));
  assert.equal(people.label('Vincent CHUA(Cairnhill TMC)'),'Vincent CHUA, DL5*');
  // November 2026 guests & Visiting Toastmasters checks
  assert.equal(people.canonical('Zhaoru LIN'),'LIN Zhaoru');
  assert.equal(people.label('Zhaoru LIN'),'LIN Zhaoru, DL4*');
  assert.equal(people.label('Emi CHUA'),'Emi CHUA, EC5, PI4*');
  assert.equal(people.label('CHAY Wen Liang'),'CHAY Wen Liang, DTM*');
  assert.equal(people.label('Isabelyn Esa'),'Isabelyn Esa, PI5, DL4, EH3*');
  assert.equal(people.label('Eugene LOW'),'Eugene LOW, PI5*');
  assert.equal(people.label('Benjamin ANG'),'Benjamin ANG, PI3*');
  for(const guestName of ['Emi CHUA','CHAY Wen Liang','Isabelyn Esa','LIN Zhaoru','Eugene LOW','Benjamin ANG']){
    assert.ok(visitingPool.some(v=>v.name===guestName),`Missing ${guestName} in data/visiting-toastmasters.json`);
  }
  assert.equal(roles.canonicalRole('SAA'),'Sergeant at Arms');
  assert.equal(roles.canonicalRole('Speech 5'),null);
  fs.mkdirSync(output,{recursive:true});fs.mkdirSync(scratch,{recursive:true});
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{})});
  try {
    const context=await browser.newContext({viewport:{width:1280,height:1000}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>typeof backendReady!=='undefined'&&backendReady);
    const actual=await page.evaluate(()=>bookings.filter(r=>r.meeting_date==='2026-09-11'));
    assert.equal(actual.length,14);
    for(const row of source.records){const got=actual.find(r=>r.reservation_type===row.reservation_type);for(const k of ['member_name','note','confirmed'])assert.equal(got[k],row[k],row.reservation_type+' '+k);}
    // Render administrative data without authenticating or sending any write request.
    await page.evaluate(()=>{adminMeeting.innerHTML='<option value="2026-09-11">September</option>';renderAdmin();});
    assert.ok((await page.locator('select[data-role="Prepared Speech 2"]').nth(2).inputValue()).includes('L2 Project 4: How to Say It'));
    const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>downloadICS(meetings.findIndex(m=>m.date==='2026-09-11')));const calendar=await downloadPromise;
    await calendar.saveAs(path.join(output,'ToastFlow-2026-09-11.ics'));
    const calendarText=fs.readFileSync(path.join(output,'ToastFlow-2026-09-11.ics'),'utf8');
    const unfolded=calendarText.replace(/\r\n /g,'');
    assert.ok(unfolded.includes('LOCATION:Classroom 3.1'));assert.ok(unfolded.includes('80 Stamford Rd'));assert.ok(unfolded.includes('Singapore 178902'));
    assert.ok(unfolded.includes('DTSTART:20260911T113000Z'));assert.ok(unfolded.includes('DTEND:20260911T135500Z'));assert.ok(calendarText.split('\r\n').every(l=>Buffer.byteLength(l,'utf8')<=75));
    await page.screenshot({path:path.join(scratch,'planner.png'),fullPage:true});
    const sheetPromise=context.waitForEvent('page');await page.evaluate(()=>generateSheet());
    const sheet=await sheetPromise;sheet.on('pageerror',e=>errors.push(e.message));await sheet.waitForLoadState('networkidle');
    const payload=await page.evaluate(()=>JSON.parse(localStorage.getItem('toastflow_sheet')));
    assert.equal(Object.keys(payload.assignments).length,14);
    const right=await sheet.locator('#agenda').innerText();
    assert.ok(right.includes('Vincent CHUA, DL5*'));assert.ok(right.includes('Marc WONG, DL5*'));
    assert.ok(!right.includes('Cairnhill'));assert.ok(!right.includes('Anchorvale'));
    assert.ok(right.includes('Jun TAY, PM5*'));assert.ok(right.includes('Suren Haris ANWAR, PM2*'));
    assert.ok(right.includes('9:55'));assert.ok(!right.includes('Get to the Point'));
    assert.ok(!(await sheet.locator('.p2').innerText()).includes('90 Stamford'));
    assert.equal(await sheet.locator('#reviewNote').isVisible(),false);
    assert.equal(await sheet.locator('.menti-qr:visible').count(),3);
    assert.equal(await sheet.locator('#locationDetails .map:visible').count(),1);
    assert.ok(!(await sheet.locator('#objectives').innerText()).includes('to be confirmed'));
    assert.ok((await sheet.locator('#objectives').innerText()).includes('10–15 min'));
    await assertAllSheetImagesLoaded(sheet,'September sheet');
    const wordPromise=sheet.waitForEvent('download');await sheet.evaluate(()=>exportWord());const word=await wordPromise;
    const sepDocxPath=path.join(output,'NUSA-Program-2026-09-11.docx');
    await word.saveAs(sepDocxPath);
    const sepDocxInfo=verifyDocx(sepDocxPath,['80 Stamford','Jun TAY'],['90 Stamford','DontDisplayPageBoundaries'],8);
    const encoded=encodeURIComponent(Buffer.from(JSON.stringify(payload),'utf8').toString('base64'));
    const fresh=await context.newPage();await fresh.goto(base+'programming-sheet.html?d='+encoded,{waitUntil:'networkidle'});
    assert.equal(await fresh.locator('#agenda').innerText(),right);

    // ---- November 13 (2026-11-13) verification: venue SCIS 2, regular 7:30-9:50 no Ah Counter, 6 Visiting TMs, .docx & offline HTML ----
    await page.evaluate(()=>{adminMeeting.innerHTML='<option value="2026-11-13">November</option>';window.open=()=>null;generateSheet();});
    const novPayload=await page.evaluate(()=>JSON.parse(localStorage.getItem('toastflow_sheet')));
    assert.equal(novPayload.schedule.end,'9:50');
    assert.equal(novPayload.schedule.ah,'');
    assert.equal(novPayload.guests.length,6);
    assert.equal(novPayload.meta.address,'90 Stamford Rd, Singapore 178903');
    assert.ok(novPayload.meta.directions.endsWith('systems-2'));
    assert.equal(novPayload.assignments['Language Evaluator'].confirmed,true);
    assert.equal(novPayload.assignments['Language Evaluator'].name,'Isabelyn Esa');
    const novPage=await context.newPage();novPage.on('pageerror',e=>errors.push(e.message));
    await novPage.goto(base+'programming-sheet.html?d='+encodeURIComponent(Buffer.from(JSON.stringify(novPayload),'utf8').toString('base64')),{waitUntil:'networkidle'});
    const novAgenda=await novPage.locator('#agenda').innerText();
    assert.ok(novAgenda.includes('9:50'));
    assert.ok(novAgenda.includes('20 min'));
    assert.ok(!novAgenda.includes('Ah Counter Report'));
    for(const lbl of ['Isabelyn Esa, PI5, DL4, EH3*','Emi CHUA, EC5, PI4*','CHAY Wen Liang, DTM*','Eugene LOW, PI5*','LIN Zhaoru, DL4*','Benjamin ANG, PI3*']){
      assert.ok(novAgenda.includes(lbl),`Expected "${lbl}" in Nov agenda`);
    }
    assert.ok(!novAgenda.includes('Competitive Speakers HK'),'Club should stay in sidebar, not agenda column');
    const novVisitors=await novPage.locator('#visitors').innerText();
    assert.ok(novVisitors.includes('* Visiting Toastmasters'));
    assert.ok(novVisitors.includes('Competitive Speakers HK'));
    assert.ok(novVisitors.includes('Lion Toastmasters'));
    assert.equal(await novPage.locator('#meetingAddress').innerText(),'90 Stamford Rd, Singapore 178903');
    assert.ok((await novPage.locator('#venue').innerText()).includes('Classroom 4.3'));
    assert.ok((await novPage.locator('#locDirections').getAttribute('href')).endsWith('systems-2'));
    await assertAllSheetImagesLoaded(novPage,'November sheet');
    const novObj=await novPage.locator('#objectives').innerText();
    assert.ok(novObj.includes('Evaluation and Feedback')&&novObj.includes('5–7 min'));
    assert.ok(novObj.includes('A New Journey'));

    const novWordPromise=novPage.waitForEvent('download');await novPage.evaluate(()=>exportWord());const novWord=await novWordPromise;
    const novDocxPath=path.join(output,'NUSA-Program-2026-11-13.docx');
    await novWord.saveAs(novDocxPath);
    const novDocxInfo=verifyDocx(novDocxPath,['90 Stamford Rd','Classroom 4.3','Isabelyn Esa, PI5, DL4, EH3*','Emi CHUA, EC5, PI4*','CHAY Wen Liang, DTM*','LIN Zhaoru, DL4*'],['Ah Counter Report','80 Stamford','DontDisplayPageBoundaries'],8);

    const htmlPromise=novPage.waitForEvent('download');await novPage.evaluate(()=>saveStandaloneHtml());const savedHtml=await htmlPromise;
    const savedHtmlPath=path.join(scratch,'NUSA-Program-Sheet-2026-11-13-saved.html');
    await savedHtml.saveAs(savedHtmlPath);

    // Offline file:// test of saved standalone HTML (even with stale localStorage present on file:// origin)
    const fileCtx=await browser.newContext({viewport:{width:1280,height:1000}});
    const filePage=await fileCtx.newPage();filePage.on('pageerror',e=>errors.push(e.message));
    await filePage.goto('file://'+savedHtmlPath,{waitUntil:'load'});
    await filePage.evaluate(()=>{try{localStorage.setItem('toastflow_sheet',JSON.stringify({date:'2026-09-11',assignments:{}}));}catch(_){}});
    await filePage.reload({waitUntil:'load'});
    assert.equal(await filePage.locator('#agenda').innerText(),novAgenda);
    assert.equal(await filePage.locator('#src').innerText(),'· saved offline snapshot');
    await assertAllSheetImagesLoaded(filePage,'Saved standalone file:// HTML');
    const offlineDocxPromise=filePage.waitForEvent('download');await filePage.evaluate(()=>exportWord());const offlineDocx=await offlineDocxPromise;
    const offlineDocxPath=path.join(scratch,'NUSA-Program-2026-11-13-offline.docx');
    await offlineDocx.saveAs(offlineDocxPath);
    verifyDocx(offlineDocxPath,['90 Stamford Rd','Isabelyn Esa, PI5, DL4, EH3*'],['Ah Counter Report'],8);
    await filePage.close();

    // Direct file:// open of templates/NUSA-Programming-Sheet-template.html?date=2026-11-13
    const tplPage=await fileCtx.newPage();tplPage.on('pageerror',e=>errors.push(e.message));
    await tplPage.goto('file://'+path.join(root,'templates/NUSA-Programming-Sheet-template.html')+'?date=2026-11-13',{waitUntil:'load'});
    await assertAllSheetImagesLoaded(tplPage,'Template file:// direct open');
    assert.equal(await tplPage.locator('#meetingAddress').innerText(),'90 Stamford Rd, Singapore 178903');
    assert.ok((await tplPage.locator('#agenda').innerText()).includes('9:50'));
    assert.ok(!(await tplPage.locator('#agenda').innerText()).includes('Ah Counter Report'));
    await fileCtx.close();

    await novPage.screenshot({path:path.join(scratch,'november-sheet.png'),fullPage:true});
    await novPage.pdf({path:path.join(output,'NUSA-Program-2026-11-13.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
    await novPage.close();

    // October keeps its saved online project without leaking September guests or venue.
    await page.evaluate(()=>{adminMeeting.innerHTML='<option value="2026-10-09">October</option>';window.open=()=>null;generateSheet();});
    const october=await page.evaluate(()=>JSON.parse(localStorage.getItem('toastflow_sheet')));assert.equal(october.guests.length,0);assert.equal(october.meta.address,'');assert.equal(october.final,false);
    await fresh.goto(base+'programming-sheet.html?d='+encodeURIComponent(Buffer.from(JSON.stringify(october)).toString('base64')),{waitUntil:'networkidle'});assert.ok(!(await fresh.locator('.sheet').first().innerText()).includes('Vincent CHUA'));assert.equal(await fresh.locator('.menti-qr:visible').count(),3);
    // Missing future projects stay empty even when a speaker (Sandy GOH) has prior history.
    await page.evaluate(()=>{adminMeeting.innerHTML='<option value="2026-12-11">December</option>';window.open=()=>null;generateSheet();});
    const december=await page.evaluate(()=>JSON.parse(localStorage.getItem('toastflow_sheet')));
    assert.equal(december.assignments['Prepared Speech 1'].project,'');
    assert.equal(december.guests.length,0);assert.equal(december.meta.address,'');assert.equal(december.final,false);
    await page.evaluate(()=>{adminMeeting.innerHTML='<option value="2026-08-14">August</option>';generateSheet();});const august=await page.evaluate(()=>JSON.parse(localStorage.getItem('toastflow_sheet')));assert.equal(august.schedule.end,'9:50');assert.equal(august.guests.length,4);assert.ok(!august.guests.some(g=>g.name==='Jun TAY'));
    await sheet.screenshot({path:path.join(scratch,'september-sheet.png'),fullPage:true});
    await sheet.pdf({path:path.join(output,'NUSA-Program-2026-09-11.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({base,verifiedRoles:actual.length,confirmed:actual.filter(r=>r.confirmed).length,tentative:actual.filter(r=>!r.confirmed).length,sepDocx:sepDocxInfo,novDocx:novDocxInfo,checks:'canonical identities, visiting pool, September/October/August isolation, November 2026 schedule/venue/guests, native .docx binary media, standalone offline file:// HTML & template image embedding',pdf:path.join(output,'NUSA-Program-2026-09-11.pdf')},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
