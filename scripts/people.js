/* Reviewed display identities: July/August final PDFs + September appointment plan.
   Aliases are explicit. Never guess a person's surname or merge on a first name.
   Club affiliations are separate from names and only rendered in the left column. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ToastFlowPeople=api;})(typeof self!=='undefined'?self:this,function(){
  const people=[
    {name:'Jonta KOGA',credentials:'PI2',aliases:['Jonta Koga']},
    {name:'Sandy GOH',credentials:'PM3',aliases:['Sandy W. Goh','Sandy Goh','Sandy']},
    {name:'XU Jiaqi',credentials:'PM1',aliases:['Jiaqi Xu','Xu Jiaqi']},
    {name:'LAU Kwong Fook',credentials:'ATMB, CL',aliases:['Kwong Fook Lau','Lau Kwong Fook']},
    {name:'Jeanie LEE',credentials:'ATMB, CL',aliases:['Jeanie Lee Chin Ying','Jeanie Lee']},
    {name:'LER Wee Meng',credentials:'ATMB, CL',aliases:['Wee Meng Ler','Ler Wee Meng']},
    {name:'Kelvin SIM',credentials:'PI2',aliases:['Kelvin Sim']},
    {name:'Sabrina XU',credentials:'PI3',aliases:['Sabrina X. Xu','Sabrina Xu']},
    {name:'WEE Gee Shing',credentials:'PI4',aliases:['Wee Gee Shing','Wee GeeShing']},
    {name:'TU Yu',credentials:'CC',aliases:['Yu Tu','Tu Yu']},
    {name:'GOH Shu Ching',credentials:'PM5, EH3',aliases:['Shu Ching Goh','Goh Shu Ching','Shuching']},
    {name:'Jayden TEO',credentials:'',aliases:['Jayden Teo']},
    {name:'Sara LIM',credentials:'',aliases:['Sara Lim']},
    {name:'Winona LIM',credentials:'',aliases:['Winona Lim']},
    {name:'CHEN Qin',credentials:'VC5',aliases:['Chen Qin']},
    {name:'Natalie WAI',credentials:'',aliases:['Natalie Wai','Natalie']},
    {name:'Attapol PINSA',credentials:'LP1',aliases:['Attapol Pinsa'],club:'Toa Payoh Central CC',visiting:true},
    {name:'Jai Ganesh Supra',credentials:'PI3',aliases:['Jai Ganesh Supra'],club:'Ace the Place CC',visiting:true,surnameReview:true},
    {name:'Sam LIM',credentials:'DTM',aliases:['Sam Lim'],club:'Lion City',visiting:true},
    {name:'Shelley CHOW',credentials:'VC1',aliases:['Shelley Chow'],club:'LCS',visiting:true},
    {name:'Eugene LOW',credentials:'PI5',aliases:['Eugene Low'],club:'SRC'},
    {name:'Gordon YIT',credentials:'PM4',aliases:['Gordon Yit'],club:'NUS',visiting:true},
    {name:'Vincent CHEN',credentials:'SR3',aliases:['Vincent Chen'],club:'Tampines Changkat',visiting:true},
    {name:'Vincent CHUA',credentials:'DL5',aliases:['Vincent Chua'],club:'Cairnhill TMC',visiting:true},
    {name:'Marc WONG',credentials:'DL5, PM1',aliases:['Marc Wong'],club:'Anchorvale CC',visiting:true},
    {name:'Cecilia NATHEN',credentials:'VC5',aliases:['Cecilia Nathen'],club:'SIM 2',visiting:true},
    {name:'Tang Keen Yeen',credentials:'',aliases:['Tang Keen Yeen'],club:'NUSS',visiting:true},
    {name:'Valerie CHOW',credentials:'PM4',aliases:['Valerie Chow'],club:'LCS',visiting:true},
    {name:'Ishita BANERJEE',credentials:'LD4',aliases:['Ishita Banerjee'],club:'ACCA',visiting:true},
    {name:'Pawan JAISWAL',credentials:'LD3',aliases:['Pawan Jaiswal'],club:'Toastmasters',visiting:true},
    {name:'Gasper WONG',credentials:'VC2',aliases:['Gasper Wong'],club:'Toa Payoh Central CC',visiting:true},
    {name:'Christine LIM',credentials:'DTM',aliases:['Christine Lim'],club:'ISCA',visiting:true},
    {name:'Eric TAN',credentials:'DTM',aliases:['Eric Tan'],club:'Toastmasters',visiting:true},
    {name:'Gary Ang Yee',credentials:'',aliases:['Gary Ang Yee'],club:'NTU Alumni',visiting:true},
    {name:'Benjamin ZHOU',credentials:'',aliases:['Benjamin Zhou'],club:'Anchorvale CC',visiting:true},
    {name:'Benjamin ANG',credentials:'',aliases:['Benjamin Ang'],club:'NUSS',visiting:true},
    {name:'LIVIO',credentials:'',aliases:['Livio'],club:'Bukit Timah CC',visiting:true},
    {name:'Jun TAY',credentials:'PM5',aliases:['Jun Tay'],club:'ACCA',visiting:true},
    {name:'Suren Haris ANWAR',credentials:'PM2',aliases:['Suren Haris Anwar'],club:'Katong CC',visiting:true},
    {name:'Timothy LIN',credentials:'DTM',aliases:['Timothy Lin'],club:'Toastmasters',visiting:true},
    {name:'Zhaoru LIN',credentials:'',aliases:['Zhaoru Lin'],club:'Lion Toastmasters',visiting:true,contact:'97779087'},
    {name:'Shobha SINGH',credentials:'',aliases:['Shobha Singh'],club:'Mizuho TM',visiting:true,contact:'98377722'}
  ];
  const clean=s=>String(s||'').replace(/\([^)]*\)/g,'').replace(/[?*+]/g,'').replace(/,\s*(?:[A-Z]{2,5}\s*\d?|CL)\b.*$/i,'').replace(/\s+/g,' ').trim();
  const key=s=>clean(s).toLowerCase();
  const aliases=new Map();people.forEach(p=>[p.name,...p.aliases].forEach(n=>aliases.set(key(n),p)));
  function find(name){return aliases.get(key(name))||null;}
  function canonical(name){return find(name)?.name||clean(name);}
  function label(name){const p=find(name);return p?p.name+(p.credentials?', '+p.credentials:'')+(p.visiting?'*':''):clean(name);}
  return {people,find,canonical,label,clean};
});
