/* Date-scoped programme metadata. Never use September guests or venue as
   defaults for another date. Assignment authority remains the live database. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ToastFlowMeetings=api;})(typeof self!=='undefined'?self:this,function(){
  const septemberSchedule={saa:'7:30',tme:'7:40',president:'7:45',speeches:'7:55',break:'8:45',breakMinutes:15,topics:'9:00',topicsMinutes:15,evaluations:'9:15',ah:'9:30',language:'9:35',awards:'9:45',end:'9:55',end24:'21:55'};
  const augustSchedule={...septemberSchedule,break:'8:30',breakMinutes:20,topics:'8:50',topicsMinutes:20,evaluations:'9:10',ah:'9:25',language:'9:30',awards:'9:40',end:'9:50',end24:'21:50'};
  const regularSchedule=augustSchedule;
  const programmes={
    '2026-08-14':{schedule:augustSchedule,address:'90 Stamford Rd, Singapore 178903',guests:[
      {name:'Attapol PINSA',credentials:'LP1',club:'Toa Payoh Central CC'},
      {name:'Jai Ganesh Supra',credentials:'PI3',club:'Ace the Place CC'},
      {name:'Sam LIM',credentials:'DTM',club:'Lion City'},
      {name:'Shelley CHOW',credentials:'VC1',club:'LCS'}
    ]},
    '2026-09-11':{
      source:'NUSA-Programming-Sheet-2026-09-11 Final.doc',
      final:true,
      map:'assets/meetings/2026-09-11/location-map.png',
      voting:[{image:'assets/meetings/2026-09-11/vote-prepared.png'},{image:'assets/meetings/2026-09-11/vote-topics.png'},{image:'assets/meetings/2026-09-11/vote-evaluator.png'}],
      schedule:septemberSchedule,
      venue:'Classroom 3.1, SMU School of Computing and Information Systems 1',
      address:'80 Stamford Rd, Singapore 178902',
      directions:'https://academy.smu.edu.sg/getting-smu/smu-school-computing-and-information-systems-1',
      guests:[
        {name:'Vincent CHUA',credentials:'DL5',club:'Cairnhill TMC'},
        {name:'Marc WONG',credentials:'DL5',club:'Anchorvale CC'},
        {name:'Suren Haris ANWAR',credentials:'PM2',club:'Katong TMC'},
        {name:'Jun TAY',credentials:'PM5',club:'ACCA TMC'}
      ]
    },
    '2026-11-13':{
      source:'NUSA TMC Program Sheet Nov 2026.pdf',
      final:true,
      map:'assets/location-map-scis2.png',
      schedule:{...regularSchedule,ah:''},
      venue:'Classroom 4.3, SMU School of Economics / School of Computing and Information Systems 2',
      address:'90 Stamford Rd, Singapore 178903',
      directions:'https://academy.smu.edu.sg/getting-smu/smu-school-economics-school-computing-information-systems-2',
      guests:[
        {name:'Benjamin ANG',credentials:'PI3',club:'NUSS'},
        {name:'Emi CHUA',credentials:'EC5, PI4',club:''},
        {name:'CHAY Wen Liang',credentials:'DTM',club:''},
        {name:'Eugene LOW',credentials:'PI5',club:'SRC'},
        {name:'LIN Zhaoru',credentials:'DL4',club:'Lion Toastmasters'},
        {name:'Isabelyn Esa',credentials:'PI5, DL4, EH3',club:'Competitive Speakers HK'}
      ]
    }
  };
  const defaultVoting=[
    {image:'assets/menti-prepared.png'},
    {image:'assets/menti-tabletopics.png'},
    {image:'assets/menti-evaluator.png'}
  ];
  let overrides={};
  function get(date){return JSON.parse(JSON.stringify(overrides[date]||programmes[date]||{schedule:regularSchedule,scheduleTentative:true,guests:[],voting:defaultVoting}));}
  function set(date,programme){overrides[date]=JSON.parse(JSON.stringify(programme));}
  function replace(rows){overrides={};rows.forEach(r=>set(r.meeting_date,r.programme));}
  return {get,set,replace};
});
