/* The latest final August programme is the standard chapter-meeting baseline.
   July included officers' installation and is not a standard timing template. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ToastFlowProgramme=api;})(typeof self!=='undefined'?self:this,function(){
  const objectives={
    'Evaluation and Feedback First Speech':{objective:'The purpose of this project is to practice applying feedback and serve as a speech evaluator during a club meeting. The purpose of this speech is for the member to present a speech and receive feedback from the evaluator.',timing:'5–7 min'},
    'How to Say It':{objective:'The purpose of this project is for the speaker to select clear, accurate, descriptive, and short words, using precise arrangements and action-oriented verbs to effectively communicate their message to the audience.',timing:'5–7 min'},
    'Better Speaker Series - Beginning Your Speech':{objective:'The purpose of this project is to provide criteria and techniques for speech openings, helping club members grab audience attention, establish rapport, and introduce their topic effectively.',timing:'10–15 min'},
    'Successful Club Series - Evaluate to Motivate':{objective:'The purpose of this project is to explain the importance of speech evaluations in Toastmasters and present effective techniques that help evaluators deliver encouraging, supportive, and actionable feedback.',timing:'10–15 min'},
    'Level 1 Evaluation and Feedback First Speech':{objective:'Purpose (paraphrased): Practise applying feedback and serving as a speech evaluator at a club meeting. For this first speech, deliver a speech and receive feedback from the evaluator.',timing:'5–7 min',source:'https://ccdn.toastmasters.org/medias/files/department-documents/education-documents/evaluation-resources/english/8100e1-evaluation-resource-first-speech.pdf'},
    'Level 5 Successful Club Series - Evaluate to Motivate.':{objective:'Programme aim (paraphrased): Practise giving evaluations that help both the speaker and the audience. This is a Successful Club Series presentation; the source plan calls it Level 5, but does not identify a Pathways project.',timing:'10 min',source:'https://france.toastmasters.org/magazine/magazine-issues/2017/august2017/speech-evaluations'},
    'Ice Breaker':{objective:'The purpose of this project is for the member to introduce himself or herself to the club and learn the basic structure of a public speech.',timing:'4–6 min'},
    'The Ice Breaker':{objective:'The purpose of this project is for the member to introduce himself or herself to the club and learn the basic structure of a public speech.',timing:'4–6 min'},
    'Organize Your Speech':{objective:'Select an appropriate outline; make your message clear with supporting material; use appropriate transitions; create a strong opening and conclusion.',timing:'5–7 min'},
    'Organise your Speech':{objective:'• Select an appropriate outline which allows listeners to easily follow and understand your speech.\n• Make your message clear, with supporting material directly contributing to that message.\n• Use appropriate transitions when moving from one idea to another.\n• Create a strong opening and conclusion.',timing:'5–7 min'},
    'Get to the Point':{objective:'• Select a speech topic and determine its general and specific purposes.\n• Organize the speech in a manner that best achieves those purposes.\n• Ensure the beginning, body and conclusion reinforce the purposes.\n• Project sincerity and conviction and control any nervousness you may feel.\n• Strive not to use notes.',timing:'5–7 min'},
    'How to Say It':{objective:'The purpose of this project is for the speaker to select clear, accurate, descriptive, and short words, using precise arrangements and action-oriented verbs to effectively communicate their message to the audience.',timing:'5–7 min'},
    'Your Body Speaks':{objective:'Use body language, posture, gestures, facial expressions, and eye contact to convey your message clearly and enhance your speech.',timing:'5–7 min'},
    'Vocal Variety':{objective:'Use voice volume, pitch, rate, and quality to reflect and add meaning and interest to your message.',timing:'5–7 min'},
    'Research Your Topic':{objective:'Collect information about your topic from numerous sources, carefully support your points with specific facts, examples, and illustrations, and deliver your speech effectively.',timing:'5–7 min'},
    'Get Comfortable with Visual Aids':{objective:'Select visual aids that are appropriate for your message and the audience; use visual aids with ease and confidence to enhance audience understanding.',timing:'5–7 min'},
    'Persuade with Power':{objective:'Present your viewpoint in a clear, compelling manner; persuade your listeners to adopt your viewpoint or ideas, or to take the action you request.',timing:'5–7 min'},
    'Inspire Your Audience':{objective:'• The purpose of this project is for the member to practice writing and delivering a speech that inspires others.\n• The purpose of the speech is for the member to inspire the audience.',timing:'8–10 min'},
    'The Entertaining Speech':{objective:'Entertain the audience through the use of humor and/or dramatic elements; organize an entertaining speech for maximum impact.',timing:'5–7 min'},
    'Resources for Entertainment':{objective:'Draw entertainment material from sources other than personal experience; adapt your material for your audience and topic.',timing:'5–7 min'},
    'Make Them Laugh':{objective:'Prepare a humorous speech drawn from your own personal experience; deliver the speech using the humorously exaggerated style.',timing:'5–7 min'},
    'A Dramatic Talk':{objective:'Develop an entertaining, dramatic talk using emotional appeal, characterization, and plot structure.',timing:'5–7 min'},
    'Speaking After Dinner':{objective:'Prepare and deliver an entertaining after-dinner speech on a specific theme or occasion; weave humor into your central message.',timing:'8–10 min'},
    'The Folk Tale':{objective:'Tell a folk tale that is entertaining and carries a moral or lesson; use voice, body, and facial expression to bring characters to life.',timing:'7–9 min'},
    'Let\'s Get Personal':{objective:'Tell a personal story from your own life experiences that is humorous or emotionally poignant.',timing:'6–8 min'},
    'The Moral of the Story':{objective:'Tell an engaging story with a clear moral or practical lesson that inspires the audience.',timing:'6–8 min'},
    'The Touching Story':{objective:'Tell an emotionally touching story that connects with the audience\'s empathy and heart.',timing:'6–8 min'},
    'Bringing History to Life':{objective:'Take a historical event, figure, or moment and bring it to vivid life through dramatic storytelling and narrative structure.',timing:'7–9 min'},
    'Creating Effective Visual Aids':{objective:'The purpose of this project is for the member to practice selecting and using a variety of visual aids during a speech.',timing:'5–7 min'},
    'Introduction to Vocal Variety and Body Language':{objective:'The purpose of this project is for the member to practice using vocal variety or body language to enhance a speech.',timing:'5–7 min'},
    'The Power of Humour in an Impromptu Speech':{objective:'The purpose of this project is for the member to develop their method for giving impromptu speeches and practice adapting rehearsed stories during a presentation.',timing:'Two × 2–3 min speeches at the same meeting'}
  };
  const bare=s=>String(s||'').replace(/^.*?\bL[1-5]\s*:\s*/i,'').replace(/^Project\s+\d+\s*:\s*/i,'').trim();
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function lookup(map,project){const k=bare(project);return map[k]||Object.entries(map).find(([n])=>norm(n)===norm(k))?.[1]||null;}
  return {objectives,bare,lookup};
});
