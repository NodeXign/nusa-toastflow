/* Native OOXML (.docx) exporter for ToastFlow Program Sheet.
   Produces a true WordprocessingML ZIP package with real binary images in word/media/
   so Microsoft Word, WPS Office, Apple Pages, and Google Docs preserve all images on open & Save As. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ToastFlowDocx=api;
})(typeof self!=='undefined'?self:this,function exportDocxFactory(){
  'use strict';

  const EMU=9525; // 1 CSS px (96 dpi) = 9525 EMUs

  function xmlEsc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&apos;');
  }

  // ---- Pure JS Store-mode ZIP builder (CRC32 + UTF-8) ----
  const CRC_TABLE=(()=>{
    const t=new Uint32Array(256);
    for(let i=0;i<256;i++){
      let c=i;
      for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[i]=c>>>0;
    }
    return t;
  })();

  function crc32(bytes){
    let c=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++) c=CRC_TABLE[(c^bytes[i])&0xFF]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0;
  }

  function makeZip(entries){
    const enc=new TextEncoder();
    const parts=[];
    const centrals=[];
    let offset=0;
    for(const entry of entries){
      const nameBytes=enc.encode(entry.name);
      const data=entry.data instanceof Uint8Array?entry.data:enc.encode(String(entry.data));
      const crc=crc32(data);
      const len=data.length;

      const lf=new Uint8Array(30+nameBytes.length);
      const dv=new DataView(lf.buffer);
      dv.setUint32(0,0x04034b50,true);
      dv.setUint16(4,20,true);
      dv.setUint16(6,0x0800,true); // UTF-8 filename flag
      dv.setUint16(8,0,true);      // Store (no compression)
      dv.setUint16(10,0,true);
      dv.setUint16(12,0x5421,true);
      dv.setUint32(14,crc,true);
      dv.setUint32(18,len,true);
      dv.setUint32(22,len,true);
      dv.setUint16(26,nameBytes.length,true);
      dv.setUint16(28,0,true);
      lf.set(nameBytes,30);
      parts.push(lf,data);

      const cd=new Uint8Array(46+nameBytes.length);
      const cv=new DataView(cd.buffer);
      cv.setUint32(0,0x02014b50,true);
      cv.setUint16(4,20,true);
      cv.setUint16(6,20,true);
      cv.setUint16(8,0x0800,true);
      cv.setUint16(10,0,true);
      cv.setUint16(12,0,true);
      cv.setUint16(14,0x5421,true);
      cv.setUint32(16,crc,true);
      cv.setUint32(20,len,true);
      cv.setUint32(24,len,true);
      cv.setUint16(28,nameBytes.length,true);
      cv.setUint16(30,0,true);
      cv.setUint16(32,0,true);
      cv.setUint16(34,0,true);
      cv.setUint16(36,0,true);
      cv.setUint32(38,0,true);
      cv.setUint32(42,offset,true);
      cd.set(nameBytes,46);
      centrals.push(cd);

      offset+=lf.length+len;
    }
    const cdSize=centrals.reduce((a,b)=>a+b.length,0);
    const eocd=new Uint8Array(22);
    const ev=new DataView(eocd.buffer);
    ev.setUint32(0,0x06054b50,true);
    ev.setUint16(4,0,true);
    ev.setUint16(6,0,true);
    ev.setUint16(8,entries.length,true);
    ev.setUint16(10,entries.length,true);
    ev.setUint32(12,cdSize,true);
    ev.setUint32(16,offset,true);
    ev.setUint16(20,0,true);

    const total=offset+cdSize+22;
    const out=new Uint8Array(total);
    let pos=0;
    for(const p of parts){out.set(p,pos);pos+=p.length;}
    for(const c of centrals){out.set(c,pos);pos+=c.length;}
    out.set(eocd,pos);
    return out;
  }

  function decodeDataUri(uri){
    const m=String(uri||'').match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if(!m)return null;
    const rawExt=m[1].toLowerCase().replace('jpeg','jpg');
    const ext=(rawExt==='png'||rawExt==='jpg'||rawExt==='gif')?rawExt:'png';
    const binStr=atob(m[2]);
    const bytes=new Uint8Array(binStr.length);
    for(let i=0;i<binStr.length;i++) bytes[i]=binStr.charCodeAt(i);
    return {ext,bytes};
  }

  function pngSize(bytes){
    if(bytes.length>=24&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4E&&bytes[3]===0x47){
      const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      return {w:dv.getUint32(16,false),h:dv.getUint32(20,false)};
    }
    return null;
  }

  function jpgSize(bytes){
    if(bytes.length<4||bytes[0]!==0xFF||bytes[1]!==0xD8)return null;
    let i=2;
    while(i+9<bytes.length){
      if(bytes[i]!==0xFF){i++;continue;}
      const marker=bytes[i+1];
      if(marker>=0xC0&&marker<=0xCF&&marker!==0xC4&&marker!==0xC8&&marker!==0xCC){
        return {h:(bytes[i+5]<<8)|bytes[i+6],w:(bytes[i+7]<<8)|bytes[i+8]};
      }
      const seg=(bytes[i+2]<<8)|bytes[i+3];
      if(seg<2)break;
      i+=2+seg;
    }
    return null;
  }

  async function resolveImageBinary(img){
    if(!img)return null;
    const attrSrc=img.getAttribute('src')||'';
    const fullSrc=img.src||'';
    const candidates=[fullSrc,attrSrc];
    for(const c of candidates){
      if(!c)continue;
      if(/^data:image\//i.test(c)){
        const parsed=decodeDataUri(c);
        if(parsed)return parsed;
      }
      if(typeof ToastFlowAssets!=='undefined'&&ToastFlowAssets.resolve){
        const r=ToastFlowAssets.resolve(c);
        if(/^data:image\//i.test(r)){
          const parsed=decodeDataUri(r);
          if(parsed)return parsed;
        }
      }
    }
    if(img.complete&&img.naturalWidth>0){
      try{
        const cv=document.createElement('canvas');
        cv.width=img.naturalWidth;cv.height=img.naturalHeight;
        cv.getContext('2d').drawImage(img,0,0);
        const parsed=decodeDataUri(cv.toDataURL('image/png'));
        if(parsed)return parsed;
      }catch(_){}
    }
    try{
      const resp=await fetch(fullSrc||attrSrc);
      const blob=await resp.blob();
      const buf=new Uint8Array(await blob.arrayBuffer());
      const ext=/jpe?g/i.test(blob.type)?'jpg':/gif/i.test(blob.type)?'gif':'png';
      return {ext,bytes:buf};
    }catch(_){}
    return null;
  }

  function fitBox(natW,natH,maxWpx,maxHpx){
    const nw=natW>0?natW:maxWpx;
    const nh=natH>0?natH:maxHpx;
    const s=Math.min(maxWpx/nw,maxHpx/nh);
    return {
      cx:Math.max(9525,Math.round(nw*s*EMU)),
      cy:Math.max(9525,Math.round(nh*s*EMU))
    };
  }

  function runXml(text,opts){
    const o=opts||{};
    const rPr=[];
    rPr.push('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>');
    if(o.bold)rPr.push('<w:b/>');
    if(o.italic)rPr.push('<w:i/>');
    if(o.color)rPr.push(`<w:color w:val="${xmlEsc(o.color)}"/>`);
    if(o.size)rPr.push(`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`);
    if(o.underline)rPr.push('<w:u w:val="single"/>');
    const lines=String(text==null?'':text).split('\n');
    const body=lines.map((line,i)=>(i?'<w:br/>':'')+`<w:t xml:space="preserve">${xmlEsc(line)}</w:t>`).join('');
    return `<w:r><w:rPr>${rPr.join('')}</w:rPr>${body}</w:r>`;
  }

  function pXml(runsXml,opts){
    const o=opts||{};
    const pPr=[];
    if(o.keepNext)pPr.push('<w:keepNext/>');
    if(o.borders)pPr.push(`<w:pBdr>${o.borders}</w:pBdr>`);
    if(o.shading)pPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${o.shading}"/>`);
    const bef=o.before!=null?o.before:0;
    const aft=o.after!=null?o.after:20;
    const lineAttr=o.line?` w:line="${o.line}" w:lineRule="${o.lineRule||'auto'}"`:'';
    pPr.push(`<w:spacing w:before="${bef}" w:after="${aft}"${lineAttr}/>`);
    if(o.align)pPr.push(`<w:jc w:val="${o.align}"/>`);
    return `<w:p><w:pPr>${pPr.join('')}</w:pPr>${runsXml||''}</w:p>`;
  }

  function inlineDomRuns(node,inherited,regLink){
    const inh=inherited||{};
    let out='';
    for(const ch of node.childNodes){
      if(ch.nodeType===3){
        const txt=ch.nodeValue.replace(/\r/g,'');
        if(txt)out+=runXml(txt,inh);
        continue;
      }
      if(ch.nodeType!==1)continue;
      const tag=ch.tagName.toLowerCase();
      if(tag==='br'){out+='<w:r><w:br/></w:r>';continue;}
      const st=ch.style||{};
      const cls=ch.className||'';
      const next={...inh};
      if(tag==='b'||tag==='strong'||st.fontWeight==='bold'||st.fontWeight==='700'||/\bag-section-title\b/.test(cls))next.bold=true;
      if(tag==='i'||tag==='em'||st.fontStyle==='italic'||/\bag-section-title\b/.test(cls)||/\bopen\b/.test(cls))next.italic=true;
      if(/\bopen\b/.test(cls))next.color='888888';
      else if(st.color){
        const m=String(st.color).match(/\d+/g);
        if(m&&m.length>=3)next.color=m.slice(0,3).map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase();
        else if(cls.includes('evallink'))next.color='B52F3B';
      }
      if(tag==='a'&&ch.getAttribute('href')){
        const href=ch.getAttribute('href');
        const lOpts={...next,color:next.color||'0563C1',underline:true};
        if(ch.closest('.evallink'))lOpts.color='B52F3B';
        const rId=regLink(href);
        out+=`<w:hyperlink r:id="${rId}">${runXml(ch.textContent,lOpts)}</w:hyperlink>`;
        continue;
      }
      if(tag==='div'){
        const inner=inlineDomRuns(ch,next,regLink);
        if(out&&inner)out+='<w:r><w:br/></w:r>';
        out+=inner;
        continue;
      }
      out+=inlineDomRuns(ch,next,regLink);
    }
    return out;
  }

  function tcBordersXml(top,bottom,left,right,sz,color){
    const c=color||'000000';
    const w=sz||4;
    const one=(side,on)=>on===false?`<w:${side} w:val="none"/>`:`<w:${side} w:val="single" w:sz="${w}" w:space="0" w:color="${c}"/>`;
    return `<w:tcBorders>${one('top',top)}${one('left',left)}${one('bottom',bottom)}${one('right',right)}</w:tcBorders>`;
  }

  function tblBordersXml(on,sz,color){
    const c=color||'000000';
    const w=sz||4;
    const sides=['top','left','bottom','right','insideH','insideV'];
    return '<w:tblBorders>'+sides.map(s=>on===false?`<w:${s} w:val="none"/>`:`<w:${s} w:val="single" w:sz="${w}" w:space="0" w:color="${c}"/>`).join('')+'</w:tblBorders>';
  }

  async function exportDocument(filename){
    const sheets=document.querySelectorAll('.sheet');
    if(!sheets.length)throw new Error('No program sheets found');
    const p1=sheets[0],p2=sheets[1];

    const media=[];
    const links=[];
    const linkMap=new Map();
    let rIdSeq=1;
    let docPrSeq=1;

    function regLink(url){
      const key=String(url||'');
      if(linkMap.has(key))return linkMap.get(key);
      const id='rId'+(rIdSeq++);
      linkMap.set(key,id);
      links.push({id,target:key});
      return id;
    }

    async function regImage(img,maxWpx,maxHpx){
      if(!img||img.hidden||img.style.display==='none')return null;
      const bin=await resolveImageBinary(img);
      if(!bin)return null;
      const idx=media.length+1;
      const rId='rId'+(rIdSeq++);
      const name=`img${idx}.${bin.ext}`;
      media.push({id:rId,path:`media/${name}`,bytes:bin.bytes,ext:bin.ext});
      const dim=(bin.ext==='png'?pngSize(bin.bytes):jpgSize(bin.bytes))||{w:img.naturalWidth||maxWpx,h:img.naturalHeight||maxHpx};
      const box=fitBox(dim.w,dim.h,maxWpx,maxHpx);
      return {rId,cx:box.cx,cy:box.cy,docPrId:docPrSeq++,name};
    }

    function imgRunXml(ref){
      if(!ref)return '';
      return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${ref.cx}" cy="${ref.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${ref.docPrId}" name="${xmlEsc(ref.name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${ref.docPrId}" name="${xmlEsc(ref.name)}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${ref.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ref.cx}" cy="${ref.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    }

    // Collect images on Page 1 & Page 2
    const tmRef=await regImage(p1.querySelector('img.tm-logo'),122,98);
    const nusRef=await regImage(p1.querySelector('img.nus-logo'),172,82);
    const payRef=await regImage(p1.querySelector('.exco img[alt*="PayNow"], .exco img.qr'),86,86);
    const regQrImgs=p1.querySelectorAll('.exco img.qr');
    const ebRef=await regImage(regQrImgs[1]||null,86,86);

    let mentiPreparedRef=null,mentiTopicsRef=null,mentiEvalRef=null,mapRef=null;
    if(p2){
      mentiPreparedRef=await regImage(p2.querySelector('#mentiPrepared'),68,68);
      mentiTopicsRef=await regImage(p2.querySelector('#mentiTopics'),68,68);
      mentiEvalRef=await regImage(p2.querySelector('#mentiEvaluator'),68,68);
      const locEl=p2.querySelector('#locationDetails');
      if(locEl&&locEl.style.display!=='none'){
        mapRef=await regImage(p2.querySelector('#locMap'),695,240);
      }
    }

    // Content width on A4 with 12mm L/R margins: 11906 - 1360 = 10546 dxa
    // ---- PAGE 1 HEADER ----
    const webLink=p1.querySelector('.hdr .web a');
    const webHref=webLink?webLink.getAttribute('href'):'http://nusalumni.toastmastersclubs.org';
    const webText=webLink?webLink.textContent:'http://nusalumni.toastmastersclubs.org';
    const mottoText=(p1.querySelector('.hdr .motto')?.textContent||'"To Live and To Grow"');
    const h1El=p1.querySelector('.hdr h1');
    const titleLines=(h1El?h1El.innerText:'NUS ALUMNI\nTOASTMASTERS CLUB').split(/\n+/).map(s=>s.trim()).filter(Boolean);

    const hdrCenter=
      pXml(titleLines.map((ln,i)=>(i?'<w:r><w:br/></w:r>':'')+runXml(ln,{bold:true,size:28})).join(''),{align:'center',before:0,after:30})
      +pXml(runXml('Web Site: ',{italic:true,size:20})+`<w:hyperlink r:id="${regLink(webHref)}">${runXml(webText,{italic:true,underline:true,color:'000000',size:20})}</w:hyperlink>`,{align:'center',before:0,after:25})
      +pXml(runXml(mottoText,{bold:true,italic:true,color:'7B2F2F',size:24}),{align:'center',before:0,after:0});

    const hdrTable=`<w:tbl>
      <w:tblPr><w:tblW w:w="10546" w:type="dxa"/>${tblBordersXml(false)}<w:tblLayout w:type="fixed"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="2150"/><w:gridCol w:w="5646"/><w:gridCol w:w="2750"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="2150" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${pXml(imgRunXml(tmRef),{align:'left',before:0,after:0})}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="5646" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${hdrCenter}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2750" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${pXml(imgRunXml(nusRef),{align:'right',before:0,after:0})}</w:tc>
      </w:tr>
    </w:tbl>`;

    const hrPara=pXml('',{before:40,after:100,line:20,lineRule:'exact',borders:'<w:bottom w:val="single" w:sz="12" w:space="1" w:color="000000"/>'});

    // ---- PAGE 1 LEFT COLUMN (.exco) ----
    const excoEl=p1.querySelector('.exco');
    let leftPs='';
    leftPs+=pXml(runXml(excoEl?.querySelector('h2')?.textContent||'Executive Committee',{bold:true,italic:true,size:22}),{before:0,after:10});
    leftPs+=pXml(runXml(excoEl?.querySelector('#excoTerm')?.textContent||'2026/ 2027',{bold:true,size:20}),{before:0,after:70});

    const excoListEl=excoEl?.querySelector('#excoList');
    if(excoListEl){
      for(const ch of excoListEl.children){
        if(ch.classList.contains('role')){
          leftPs+=pXml(runXml(ch.textContent,{bold:true,size:19}),{before:45,after:5});
        }else{
          leftPs+=pXml(inlineDomRuns(ch,{size:19},regLink),{before:0,after:20});
        }
      }
    }

    const visEl=excoEl?.querySelector('#visitors');
    if(visEl&&visEl.style.display!=='none'&&visEl.textContent.trim()){
      const visChildren=[...visEl.children];
      visChildren.forEach((vc,idx)=>{
        leftPs+=pXml(runXml(vc.textContent,{bold:idx===0,size:18}),{before:idx===0?90:10,after:10});
      });
    }

    const contactEl=excoEl?.querySelector('.contact');
    if(contactEl)leftPs+=pXml(inlineDomRuns(contactEl,{size:19},regLink),{before:90,after:15});
    const fbEl=excoEl?.querySelector('.fb');
    if(fbEl)leftPs+=pXml(inlineDomRuns(fbEl,{size:19},regLink),{before:0,after:40});

    const payTitle=excoEl?.querySelector('.paynow');
    if(payTitle)leftPs+=pXml(runXml(payTitle.textContent,{bold:true,size:19}),{before:70,after:30});
    if(payRef)leftPs+=pXml(imgRunXml(payRef),{before:10,after:25});
    const fineEl=excoEl?.querySelector('.fine');
    if(fineEl)leftPs+=pXml(runXml(fineEl.textContent,{color:'333333',size:16}),{before:0,after:45});

    const regTitle=excoEl?.querySelector('.guest-reg');
    if(regTitle)leftPs+=pXml(runXml(regTitle.textContent,{bold:true,size:19}),{before:55,after:30});
    if(ebRef)leftPs+=pXml(imgRunXml(ebRef),{before:10,after:0});

    // ---- PAGE 1 RIGHT COLUMN (Date + Venue + Agenda Table) ----
    let rightXml='';
    const agDateText=p1.querySelector('#agDate')?.textContent||'';
    rightXml+=pXml(runXml(agDateText,{bold:true,size:20}),{align:'center',before:0,after:35});

    const venueEl=p1.querySelector('.ag-meta .venue-row');
    if(venueEl)rightXml+=pXml(inlineDomRuns(venueEl,{size:20},regLink),{before:0,after:15});
    const addrEl=p1.querySelector('.ag-meta .addr-row');
    if(addrEl)rightXml+=pXml(inlineDomRuns(addrEl,{bold:true,italic:true,size:20},regLink),{before:0,after:15});
    const dressEl=p1.querySelector('.ag-meta .dress-row');
    if(dressEl)rightXml+=pXml(inlineDomRuns(dressEl,{size:20},regLink),{before:0,after:60});

    const revEl=p1.querySelector('#reviewNote');
    if(revEl&&!revEl.hidden&&revEl.textContent.trim()){
      rightXml+=pXml(runXml(revEl.textContent,{size:17}),{before:20,after:60,shading:'FFF8E6',borders:'<w:top w:val="single" w:sz="4" w:color="9E7200"/><w:left w:val="single" w:sz="4" w:color="9E7200"/><w:bottom w:val="single" w:sz="4" w:color="9E7200"/><w:right w:val="single" w:sz="4" w:color="9E7200"/>'});
    }

    const agendaTrs=[...p1.querySelectorAll('#agenda tr')];
    const agCols=[860,4206,2500]; // total = 7566 dxa
    let agRowsXml='';
    agendaTrs.forEach(tr=>{
      const cls=tr.className||'';
      const isSpacer=/\bag-spacer\b/.test(cls);
      const isFirst=/\bgrp-first\b/.test(cls);
      const isMid=/\bgrp-mid\b/.test(cls);
      const isLast=/\bgrp-last\b/.test(cls);
      const topOn=!(isMid||isLast);
      const botOn=!(isFirst||isMid);
      const borders=tcBordersXml(topOn,botOn,true,true,4,'000000');
      const cells=[...tr.children];
      let trXml='';
      if(isSpacer)trXml+='<w:trPr><w:trHeight w:val="90" w:hRule="exact"/></w:trPr>';
      else trXml+='<w:trPr><w:cantSplit/></w:trPr>';
      cells.forEach((td,ci)=>{
        const w=agCols[ci]||2000;
        const pContent=isSpacer
          ? pXml('',{before:0,after:0,line:20,lineRule:'exact'})
          : pXml(inlineDomRuns(td,{size:19},regLink),{before:0,after:0});
        trXml+=`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${borders}<w:tcMar><w:top w:w="${isSpacer?0:25}" w:type="dxa"/><w:bottom w:w="${isSpacer?0:25}" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tcMar></w:tcPr>${pContent}</w:tc>`;
      });
      agRowsXml+=`<w:tr>${trXml}</w:tr>`;
    });

    rightXml+=`<w:tbl>
      <w:tblPr><w:tblW w:w="7566" w:type="dxa"/>${tblBordersXml(true,4,'000000')}<w:tblLayout w:type="fixed"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="860"/><w:gridCol w:w="4206"/><w:gridCol w:w="2500"/></w:tblGrid>
      ${agRowsXml}
    </w:tbl>`+pXml('',{before:0,after:0,line:20,lineRule:'exact'});

    const bodyTable=`<w:tbl>
      <w:tblPr><w:tblW w:w="10546" w:type="dxa"/>${tblBordersXml(false)}<w:tblLayout w:type="fixed"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="2820"/><w:gridCol w:w="160"/><w:gridCol w:w="7566"/></w:tblGrid>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="2820" w:type="dxa"/>${tcBordersXml(false,false,false,false)}</w:tcPr>${leftPs}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="160" w:type="dxa"/>${tcBordersXml(false,false,false,false)}</w:tcPr>${pXml('',{before:0,after:0})}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="7566" w:type="dxa"/>${tcBordersXml(false,false,false,false)}</w:tcPr>${rightXml}</w:tc>
      </w:tr>
    </w:tbl>`;

    // ---- PAGE 2 ----
    let page2Xml='';
    if(p2){
      page2Xml+=pXml('<w:r><w:br w:type="page"/></w:r>',{before:0,after:0,line:20,lineRule:'exact'});

      // Awards table
      const awardCells=[...p2.querySelectorAll('table.awards td')];
      if(awardCells.length){
        const awW=Math.floor(10546/awardCells.length);
        const awTcs=awardCells.map(td=>`<w:tc><w:tcPr><w:tcW w:w="${awW}" w:type="dxa"/>${tcBordersXml(true,true,true,true,4,'000000')}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:bottom w:w="420" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${pXml(runXml(td.textContent,{bold:true,size:20}),{before:0,after:0})}</w:tc>`).join('');
        page2Xml+=`<w:tbl><w:tblPr><w:tblW w:w="10546" w:type="dxa"/>${tblBordersXml(true,4,'000000')}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${awardCells.map(()=>`<w:gridCol w:w="${awW}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${awTcs}</w:tr></w:tbl>`;
      }

      // Vote for Best Speeches
      page2Xml+=pXml(runXml('Vote for Best Speeches',{bold:true,underline:true,size:24}),{before:180,after:90,keepNext:true});
      const vCols=[...p2.querySelectorAll('.voting-col')];
      const mentiRefs=[mentiPreparedRef,mentiTopicsRef,mentiEvalRef];
      const vW=Math.floor(10546/3);
      const vTcs=vCols.map((col,idx)=>{
        const title=col.querySelector('.menti-title')?.textContent||'';
        const ref=mentiRefs[idx];
        const urlLink=col.querySelector('.menti-url a');
        let content=pXml(runXml(title,{size:20}),{before:0,after:60});
        if(ref)content+=pXml(imgRunXml(ref),{before:20,after:40});
        if(urlLink&&col.querySelector('.menti-url')?.style.display!=='none'){
          content+=pXml(`<w:hyperlink r:id="${regLink(urlLink.getAttribute('href'))}">${runXml(urlLink.textContent,{underline:true,color:'0563C1',size:18})}</w:hyperlink>`,{before:0,after:0});
        }
        return `<w:tc><w:tcPr><w:tcW w:w="${vW}" w:type="dxa"/>${tcBordersXml(false,false,false,false)}<w:tcMar><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;
      }).join('');
      if(vTcs){
        page2Xml+=`<w:tbl><w:tblPr><w:tblW w:w="10546" w:type="dxa"/>${tblBordersXml(false)}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="${vW}"/><w:gridCol w:w="${vW}"/><w:gridCol w:w="${10546-2*vW}"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${vTcs}</w:tr></w:tbl>`;
      }

      // Project Objectives
      page2Xml+=pXml(runXml('Project Objectives',{bold:true,underline:true,size:24}),{before:180,after:90,keepNext:true});
      const objRows=[...p2.querySelectorAll('#objectives tr')];
      const oCols=[3427,6011,1108]; // 32.5% / 57% / 10.5% of 10546
      const oTrs=objRows.map(tr=>{
        const tds=[...tr.children];
        const tcs=tds.map((td,ci)=>{
          const w=oCols[ci]||2000;
          return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${tcBordersXml(true,true,true,true,4,'000000')}<w:tcMar><w:top w:w="55" w:type="dxa"/><w:bottom w:w="55" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tcMar></w:tcPr>${pXml(inlineDomRuns(td,{size:20},regLink),{before:0,after:0})}</w:tc>`;
        }).join('');
        return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${tcs}</w:tr>`;
      }).join('');
      page2Xml+=`<w:tbl><w:tblPr><w:tblW w:w="10546" w:type="dxa"/>${tblBordersXml(true,4,'000000')}<w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${oCols.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${oTrs}</w:tbl>`;

      // Location
      const locEl=p2.querySelector('#locationDetails');
      if(locEl&&locEl.style.display!=='none'){
        page2Xml+=pXml(runXml('Location',{bold:true,underline:true,size:24}),{before:180,after:70,keepNext:true});
        const dirWrap=locEl.querySelector('.loc-dir');
        const dirA=locEl.querySelector('#locDirections');
        if(dirWrap&&dirWrap.style.display!=='none'&&dirA){
          const href=dirA.getAttribute('href')||dirA.textContent;
          page2Xml+=pXml(runXml('Directions: ',{bold:true,size:20})+`<w:hyperlink r:id="${regLink(href)}">${runXml(dirA.textContent,{underline:true,color:'0563C1',size:20})}</w:hyperlink>`,{before:0,after:80});
        }
        if(mapRef)page2Xml+=pXml(imgRunXml(mapRef),{before:20,after:0});
      }
    }

    const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      +`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">`
      +`<w:body>${hdrTable}${hrPara}${bodyTable}${page2Xml}`
      +`<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="680" w:bottom="567" w:left="680" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`
      +`</w:body></w:document>`;

    const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      +`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      +media.map(m=>`<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${xmlEsc(m.path)}"/>`).join('')
      +links.map(l=>`<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEsc(l.target)}" TargetMode="External"/>`).join('')
      +`</Relationships>`;

    const rootRelsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      +`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      +`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`
      +`</Relationships>`;

    const ctXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
      +`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      +`<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      +`<Default Extension="xml" ContentType="application/xml"/>`
      +`<Default Extension="png" ContentType="image/png"/>`
      +`<Default Extension="jpg" ContentType="image/jpeg"/>`
      +`<Default Extension="gif" ContentType="image/gif"/>`
      +`<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
      +`</Types>`;

    const zipEntries=[
      {name:'[Content_Types].xml',data:ctXml},
      {name:'_rels/.rels',data:rootRelsXml},
      {name:'word/_rels/document.xml.rels',data:relsXml},
      {name:'word/document.xml',data:docXml},
      ...media.map(m=>({name:`word/${m.path}`,data:m.bytes}))
    ];

    const zipBytes=makeZip(zipEntries);
    const blob=new Blob([zipBytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=filename||'NUSA-Program-Sheet.docx';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    return {mediaCount:media.length,linkCount:links.length,size:zipBytes.length};
  }

  return {exportDocument,factory:exportDocxFactory};
});
