// Admin-only writes; all programme fields are public event information.
async function loadMeetingProgrammes(){
  try{const response=await fetch(`${SUPABASE_URL}/rest/v1/meeting_programmes?select=meeting_date,programme`,{headers});if(!response.ok)throw new Error('Programme settings unavailable');ToastFlowMeetings.replace(await response.json());return true;}catch(error){console.warn(error.message);return false;}
}
function renderProgrammeEditor(){
  const box=document.getElementById('programmeEditor');if(!box)return;
  const date=currentAdminDate();if(box.dataset.date===date&&box.contains(document.activeElement))return;
  const p=ToastFlowMeetings.get(date),s=p.schedule;
  const fields=[['saa','SAA'],['tme','TME'],['president','President'],['speeches','Speeches'],['break','Break'],['topics','Table Topics'],['evaluations','Evaluations'],['ah','Ah Counter'],['language','Language'],['awards','Awards'],['end','End']];
  box.dataset.date=date;
  box.innerHTML='<details><summary>Meeting agenda, guests and export details — '+escapeHtml(date)+'</summary><p class="hint">Saved only for this date. Times are PM. Guest format: Name | Credential | Club (one per line). These fields are public.</p>'
    +'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">'+fields.map(([key,label])=>'<label>'+label+'<input data-agenda="'+key+'" value="'+escapeHtml(s[key])+'" placeholder="7:30"></label>').join('')+'</div>'
    +'<label>Break duration (min)<input id="programmeBreakMinutes" type="number" min="0" max="120" value="'+s.breakMinutes+'"></label>'
    +'<label>Table Topics duration (min)<input id="programmeTopicsMinutes" type="number" min="0" max="120" value="'+s.topicsMinutes+'"></label>'
    +'<label>Guest list<textarea id="programmeGuests" rows="5">'+escapeHtml((p.guests||[]).map(g=>[g.name,g.credentials||'',g.club||''].join(' | ')).join('\n'))+'</textarea></label>'
    +'<label>Address<input id="programmeAddress" value="'+escapeHtml(p.address||'')+'"></label>'
    +'<label>Directions URL<input id="programmeDirections" value="'+escapeHtml(p.directions||'')+'"></label>'
    +'<label>Voting URLs (Prepared Speech / Table Topics / Evaluator, one per line)<textarea id="programmeVoting" rows="3">'+escapeHtml((p.voting||[]).map(v=>v.url||'').join('\n'))+'</textarea></label>'
    +'<label><input type="checkbox" id="programmeFinal" style="width:auto" '+(p.final?'checked':'')+'> Reviewed for publication (all roles and export details checked)</label>'
    +'<button type="button" class="btn ghost" onclick="saveMeetingProgramme()">Save this meeting’s programme</button></details>';
}
async function saveMeetingProgramme(){
  const date=currentAdminDate(),p=ToastFlowMeetings.get(date),schedule={...p.schedule};
  try{
    for(const input of document.querySelectorAll('[data-agenda]')){const value=input.value.trim();if(input.dataset.agenda==='ah'&&!value){schedule.ah='';continue;}if(!/^(?:[1-9]|1[0-2]):[0-5]\d$/.test(value))throw new Error('Use a PM time such as 7:30');schedule[input.dataset.agenda]=value;}
    const toMin=t=>{const [h,m]=t.split(':').map(Number);return (h%12+12)*60+m;};
    const keys=['saa','tme','president','speeches','break','topics','evaluations','ah','language','awards','end'].filter(k=>k!=='ah'||schedule.ah);
    if(keys.some((k,i)=>i&&toMin(schedule[k])<=toMin(schedule[keys[i-1]])))throw new Error('Agenda times must be in increasing order');
    schedule.end24=String(Number(schedule.end.split(':')[0])%12+12).padStart(2,'0')+':'+schedule.end.split(':')[1];
    schedule.breakMinutes=Number(document.getElementById('programmeBreakMinutes').value);schedule.topicsMinutes=Number(document.getElementById('programmeTopicsMinutes').value);
    if([schedule.breakMinutes,schedule.topicsMinutes].some(n=>!Number.isInteger(n)||n<0||n>120))throw new Error('Duration must be 0–120 minutes');
    const guests=document.getElementById('programmeGuests').value.split('\n').filter(s=>s.trim()).map(line=>{const parts=line.split('|').map(s=>s.trim());if(parts.length!==3||!parts[0])throw new Error('Each guest needs Name | Credential | Club');return {name:ToastFlowPeople.canonical(parts[0]),credentials:parts[1],club:parts[2]};});
    const directions=document.getElementById('programmeDirections').value.trim();
    const urls=document.getElementById('programmeVoting').value.split('\n').map(s=>s.trim());
    if(urls.length>3||[directions,...urls].some(u=>u&&!/^https?:\/\//i.test(u)))throw new Error('Use valid http(s) links; at most three voting links');
    const voting=Array.from({length:3},(_,i)=>urls[i]?{url:urls[i]}:{...(p.voting?.[i]||{}),url:''});
    const next={...p,schedule,scheduleTentative:false,guests,address:document.getElementById('programmeAddress').value.trim(),directions,voting,final:document.getElementById('programmeFinal').checked};
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_set_programme`,{method:'POST',headers,body:JSON.stringify({p_passcode:excoPass(),p_meeting_date:date,p_programme:next})});
    if(!response.ok)throw new Error('Not saved. Check admin sign-in and connection.');
    ToastFlowMeetings.set(date,next);render();show('Programme saved for '+date+'. Generate a new sheet to export.');
  }catch(error){show(error.message);}
}
