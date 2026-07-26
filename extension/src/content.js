(async () => {
  // 扩展重载后旧上下文会失效：检测到失效时清掉旧面板并重新初始化，而不是直接退出
  const isExtContextValid = () => { try { return !!chrome?.runtime?.id; } catch { return false; } };
  if (window.__resumeAutoFillInjected) {
    if (isExtContextValid()) return;
    document.getElementById('resume-autofill-panel')?.remove();
  }
  window.__resumeAutoFillInjected = true;

  const PANEL_ID = 'resume-autofill-panel';
  const POS_KEY = 'rafPanelPosition';
  const PIN_KEY = 'rafPanelPinned';
  const VIEW_KEY = 'rafPanelView';
  const BRIGHTNESS_KEY = 'rafPanelBrightness';
  const OPACITY_KEY = 'rafPanelOpacity';
  const WIDTH_KEY = 'rafPanelWidth';
  const HEIGHT_KEY = 'rafPanelHeight';
  const GLASS_SAT_KEY = 'rafGlassSaturation';
  const AI_KEY = 'rafDeepSeekKey';
  const AI_ENABLED_KEY = 'rafAiEnabled';
  const AI_MODEL_KEY = 'rafAiModel';
  const AI_MODEL_DEFAULT = 'deepseek-v4-pro';
  const AUTOFILL_KEY = 'rafAutofillEnabled';
  const SOUND_KEY = 'rafSoundEnabled';
  const SOUND_VOLUME_KEY = 'rafSoundVolume';
  const PANEL_WIDTH_BASE = 410;
  const PANEL_WIDTH_PERCENT_MIN = 85;
  const PANEL_WIDTH_PERCENT_MAX = 150;
  const PANEL_HEIGHT_BASE = 680;
  const PANEL_HEIGHT_PERCENT_MIN = 70;
  const PANEL_HEIGHT_PERCENT_MAX = 170;
  const STORAGE_KEYS = ['resumeParsed', 'resumeFlattened', 'resumeEditable', 'resumeUpdatedAt'];
  const BASIC_FIELDS = [
    ['name','姓名','text'],['gender','性别','text'],['birthday','出生日期','date'],['city','所在城市','text'],['idType','证件类型','text'],['idNumber','证件号码','text'],
    ['phone','手机号','text'],['email','邮箱','text'],['wechat','微信号','text'],['github','GitHub','text'],['homepage','个人主页/博客','text'],['portfolio','个人作品集网站','text'],['website','个人网址','text'],['linkedin','LinkedIn','text'],['emergencyContact','紧急联系人','text'],['emergencyPhone','紧急联系方式','text'],['school','学校','text'],
    ['college','学院','text'],['major','专业','text'],['degree','学历','text'],['educationStart','入学时间','date'],['educationEnd','毕业时间','date'],['mainCourses','主修课程','textarea'],
    ['nativePlace','籍贯','text'],['politicalStatus','政治面貌','text'],['address','现居地址','text'],['jobIntent','求职意向','text'],['expectedCity','期望城市','text'],['expectedSalary','期望薪资','text'],['availableDate','到岗时间','text']
  ].map(([key,label,type]) => ({ key, label, type }));
  const EXP_GROUPS = [
    { key:'internship', label:'实习经历', fields:[
      { key:'company', label:'公司名称', type:'text' },
      { key:'role', label:'职位', type:'text' },
      { key:'start', label:'开始时间', type:'date' },
      { key:'end', label:'结束时间', type:'date' },
      { key:'description', label:'描述', type:'textarea' }
    ]},
    { key:'project', label:'项目经历', fields:[
      { key:'title', label:'项目名称', type:'text' },
      { key:'role', label:'角色', type:'text' },
      { key:'start', label:'开始时间', type:'date' },
      { key:'end', label:'结束时间', type:'date' },
      { key:'description', label:'描述', type:'textarea' }
    ]},
    { key:'work', label:'工作经历', fields:[
      { key:'company', label:'公司名称', type:'text' },
      { key:'role', label:'职位', type:'text' },
      { key:'start', label:'开始时间', type:'date' },
      { key:'end', label:'结束时间', type:'date' },
      { key:'description', label:'描述', type:'textarea' }
    ]}
  ];
  const MODULES = [
    { key:'skills', label:'技能标签', kind:'tags' },
    { key:'advantages', label:'个人优势', kind:'bullets' },
    { key:'certificates', label:'证书', kind:'records', fields:[['name','名称','text'],['date','时间','date'],['description','描述','textarea']] },
    { key:'awards', label:'奖项/获奖信息', kind:'records', fields:[['name','名称','text'],['date','时间','date'],['description','描述','textarea']] },
    { key:'academicWorks', label:'学术成果', kind:'records', fields:[['name','成果名称','text'],['date','发布时间','date'],['description','描述','textarea']] },
    { key:'languages', label:'语言能力', kind:'records', fields:[['language','语言','text'],['level','等级','text'],['score','分数','text']] },
    { key:'campusExperience', label:'校园经历', kind:'records', fields:[['name','名称','text'],['role','角色','text'],['start','开始时间','date'],['end','结束时间','date'],['description','描述','textarea']] },
    { key:'otherInfo', label:'其他扩展字段', kind:'bullets' }
  ].map((m) => m.fields ? ({ ...m, fields: m.fields.map(([key,label,type]) => ({ key, label, type })) }) : m);

  let panelVisible = false, pinned = true, currentView = 'preview', drag = null, lastActiveEditable = null, listRoot = null, panelBrightness = 100, panelOpacity = 0, panelWidthPercent = 100, panelHeightPercent = 100, glassSaturation = 20, autofillEnabled = false, soundEnabled = true, soundVolume = 100;
  let renderNonce = 0;
  let skipStorageRenderCount = 0;
  let importDebug = [];
  const byKey = (arr, key) => arr.find((x) => x.key === key);
  const truncate = (t, n = 50) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '...' : s; };
  const dateInput = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '';
  const tags = (v) => String(v || '').split(/[,，/\n|]+/).map((x) => x.trim()).filter(Boolean);
  const bullets = (v) => String(v || '').split(/\n+/).map((x) => x.replace(/^[•·\-\d.、\s]+/, '').trim()).filter(Boolean);
  const saveTags = (v) => v.map((x) => x.trim()).filter(Boolean).join(' / ');
  const saveBullets = (v) => v.map((x) => x.trim()).filter(Boolean).join('\n');
  const splitBlocks = (text) => String(text || '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const pickByRegex = (text, regex) => (String(text || '').match(regex)?.[1] || '').trim();
  const normalizeDate = (value) => {
    if (!value) return '';
    if (/^(至今|present)$/i.test(String(value).trim())) return '至今';
    const compact = String(value).replace(/[年./]/g, '-').replace(/月/g, '').replace(/日/g, '');
    const m = compact.match(/(\d{2,4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (!m) return String(value).trim();
    const yearRaw = m[1];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${m[2].padStart(2, '0')}-${(m[3] || '01').padStart(2, '0')}`;
  };
  const normalizeRawText = (raw) => String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[｜│]/g, '|')
    .replace(/～/g, '~')
    .replace(/[–—]/g, '-')
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/\r/g, '');
  const EDUCATION_HINT = /(教育经历|教育背景|学校|学院|专业|学历|主修课程|入学时间|毕业时间|本科|硕士|博士|专科|研究生)/;
  const YEAR_MONTH = '(?:\\d{2}|(?:19|20)\\d{2})[./-]\\d{1,2}';
  const PERIOD_PREFIX_RE = new RegExp(`^((?:${YEAR_MONTH})(?:\\s*(?:-|~|至|到)\\s*(?:${YEAR_MONTH}|至今|present))?)(.+)$`, 'i');
  const PERIOD_TAIL_RE = new RegExp(`^(.+?)\\s+((?:${YEAR_MONTH})(?:\\s*(?:-|~|至|到)\\s*(?:${YEAR_MONTH}|至今|present))?)$`, 'i');
  const PERIOD_ONLY_RE = new RegExp(`^((?:${YEAR_MONTH})(?:\\s*(?:-|~|至|到)\\s*(?:${YEAR_MONTH}|至今|present))?)$`, 'i');
  const withPeriodDates = (entry) => ({
    ...entry,
    start: normalizeDate((String(entry.period || '').match(new RegExp(`(${YEAR_MONTH})`)) || [])[1] || ''),
    end: normalizeDate((String(entry.period || '').match(new RegExp(`(?:-|~|至|到)\\s*(${YEAR_MONTH}|至今|present)`, 'i')) || [])[1] || '')
  });
  const ROLE_TAIL_HINT = /(产品经理|AI产品经理|产品实习生|运营实习生|算法实习生|开发工程师|前端工程师|后端工程师|测试工程师|设计师|研究员|分析师|负责人|项目负责人|创始人|合伙人|经理|实习生)$/i;
  const parseInlineEducation = (line) => {
    const clean = String(line || '').replace(/\s+/g, ' ').trim();
    if (!clean || !EDUCATION_HINT.test(clean)) return null;
    const dates = [...clean.matchAll(new RegExp(`(${YEAR_MONTH})`, 'g'))].map((m) => normalizeDate(m[1]));
    const schoolMatch = clean.match(/((?:[\u4e00-\u9fa5A-Za-z0-9]+(?:大学|学院|学校|职业技术学院|职业学院|中学)))/);
    const degreeMatch = clean.match(/(博士研究生|硕士研究生|本科|硕士|博士|大专|专科)/);
    let major = '';
    if (schoolMatch) {
      const afterSchool = clean.slice(clean.indexOf(schoolMatch[1]) + schoolMatch[1].length).trim();
      const majorMatch = afterSchool.match(/([\u4e00-\u9fa5A-Za-z0-9()/\-]+(?:专业|方向|技术|工程|设计|管理|媒体|科学|文学|法学|经济学|教育|数学|统计|传播|计算机|英语|智能|艺术)?(?:本科|硕士|博士)?)/);
      major = (majorMatch?.[1] || '').replace(/^(教育经历|学历)\s*/, '').trim();
    }
    return {
      school: schoolMatch?.[1] || '',
      degree: degreeMatch?.[1] || '',
      major: major,
      educationStart: dates[0] || '',
      educationEnd: dates[1] || ''
    };
  };
  const parseEducation = (text, blocks) => {
    const profile = {
      school: pickByRegex(text, /学校[:：]\s*([^\n]+)/),
      college: pickByRegex(text, /学院[:：]\s*([^\n]+)/),
      major: pickByRegex(text, /(?:专业|详细专业)[:：]\s*([^\n]+)/),
      degree: pickByRegex(text, /学历[:：]\s*([^\n]+)/),
      educationStart: normalizeDate(pickByRegex(text, /入学时间[:：]\s*([^\n]+)/)),
      educationEnd: normalizeDate(pickByRegex(text, /毕业时间[:：]\s*([^\n]+)/)),
      mainCourses: pickByRegex(text, /主修课程[:：]\s*([^\n]+)/)
    };
    const educationBlock = blocks.find((block) => EDUCATION_HINT.test(block)) || '';
    let inline = parseInlineEducation(educationBlock || '');
    if (!inline?.school) {
      // 表格/无标签简历：找一行同时含学校和学历/时间信息的
      const eduLine = text.split(/\n/).map((x) => x.trim()).find((l) => /(大学|学院|学校|职业技术学院|职业学院)/.test(l) && EDUCATION_HINT.test(l));
      if (eduLine) inline = parseInlineEducation(eduLine) || inline;
    }
    if (!inline) inline = parseInlineEducation(text);
    if (!profile.school && inline?.school) profile.school = inline.school;
    if (!profile.major && inline?.major) profile.major = inline.major;
    if (!profile.degree && inline?.degree) profile.degree = inline.degree;
    if (!profile.educationStart && inline?.educationStart) profile.educationStart = inline.educationStart;
    if (!profile.educationEnd && inline?.educationEnd) profile.educationEnd = inline.educationEnd;
    if (!profile.mainCourses && educationBlock) {
      const courseLine = educationBlock.split(/\n/).map((x) => x.trim()).find((line) => /主修课程/.test(line));
      if (courseLine) profile.mainCourses = courseLine.replace(/^主修课程[:：]?\s*/, '').trim();
    }
    return profile;
  };
  const MODULE_HEADER_HINT = /^(技能|能力|优势|总结|其他|技能总结|能力描述|全局经验|技能与工具|AI能力|工程能力|技术栈|核心能力|个人优势|其他信息|专业技能|专业技能与优势|技能\/优势及其他|技能优势|自我评价|个人总结|奖项荣誉|获奖情况|荣誉奖项|奖项论文专利|论文专利)(?:[:：]?\s*)$/i;
  const ABILITY_HINT = /(熟练|精通|熟悉|掌握|擅长|具备|能够|善于|方法论|工具链|技术栈|prompt engineering|rag|multi-agent|agent|workflow|aigc|llm|模型|能力)/i;
  const PROJECT_NARRATIVE_HINT = /(负责|实现|优化|上线|提升|降低|完成|重构|设计|搭建|开发|测试|落地|推动|迭代|产出|转化|准确率|时延|用户|业务|场景|需求|复盘)/;
  const TOOL_HINT = /(cursor|dify|coze|supabase|vercel|n8n|langchain|lark|notion|mysql|redis|docker|k8s|python|typescript|react|next\.?js|node\.?js|java|c\/c\+\+|c\+\+|swiftui|swiftdata|vue|spring\s?boot|springcloud|flink|kafka|elasticsearch|milvus|fastapi|sql|postgresql|oracle|qt|halcon|axure|xmind|excel|navicat|mcp)/i;
  const AI_HINT = /(ai agent|agent|multi-agent|prompt engineering|rag|llm|midjourney|stable diffusion|flux|comfyui|siliconflow|gpt|claude|qwen|deepseek)/i;
  const ENGINEERING_HINT = /(架构|工程化|性能|可观测|自动化|部署|联调|稳定性|重构|测试|监控|pipeline|workflow|serverless|ci\/cd|debug)/i;
  const AWARD_TITLE_HINT = /^(奖项荣誉|获奖情况|荣誉奖项|奖项论文专利|论文专利|奖项|荣誉|获奖经历)(?:[:：]?\s*)$/i;
  const CERT_PREFIX_HINT = /^(证书|技能证书|资格证书|职业证书)[:：]/i;
  const AWARD_PREFIX_HINT = /^(奖项|荣誉|获奖|奖学金|竞赛获奖|比赛获奖)[:：]/i;
  const ACADEMIC_PREFIX_HINT = /^(论文|专利|发表论文|科研成果|学术成果)[:：]/i;
  const ADVANTAGE_PREFIX_HINT = /^(AI能力|工程能力|产品思维|产品理解|自我评价|个人总结|个人评价|个人优势|综合能力)[:：]/i;
  const SKILL_PREFIX_HINT = /^(专业技能|技能|技术栈|技能与工具|工具|编程语言|数据库|框架|开发工具)[:：]/i;
  const SECTION_HEADER_RULES = [
    { key: 'certificates', header: /^(证书|证书信息|资格证书|职业证书|资质证书)(?:[:：]?\s*)$/ },
    { key: 'awards', header: /^(奖项|获奖信息|荣誉奖项|荣誉|获奖经历|奖项荣誉|获奖情况)(?:[:：]?\s*)$/ },
    { key: 'academicWorks', header: /^(学术成果|科研成果|论文|发表论文|专利|论文专利|奖项论文专利)(?:[:：]?\s*)$/ },
    { key: 'languages', header: /^(语言能力|语言|外语能力|语种能力)(?:[:：]?\s*)$/ },
    { key: 'campusExperience', header: /^(校园经历|在校经历|校内经历|学生工作|社团经历|校园实践)(?:[:：]?\s*)$/ }
  ];
  const isSectionHeader = (line) => {
    const text = String(line || '').trim();
    if (SECTION_HEADER_RULES.some((rule) => rule.header.test(text))) return true;
    if (text.length > 16) return false; // 长行不可能是标题，防止误截断正文
    return /(教育经历|教育背景|项目经历|工作经历|实习经历|技能|能力|优势|总结|其他信息|个人优势|专业技能|自我评价|个人总结|奖项荣誉|获奖情况|论文专利)/.test(text);
  };
  const collectSectionLines = (text, key) => {
    const rule = SECTION_HEADER_RULES.find((item) => item.key === key);
    if (!rule) return [];
    const lines = String(text || '').split(/\n/);
    const sections = [];
    let current = [];
    let active = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (rule.header.test(line)) {
        if (active && current.length) sections.push(current);
        active = true;
        current = [];
        continue;
      }
      if (active && isSectionHeader(line)) {
        if (current.length) sections.push(current);
        active = false;
        current = [];
        continue;
      }
      if (active) current.push(rawLine);
    }
    if (active && current.length) sections.push(current);
    return sections.flat().map((line) => line.trim()).filter(Boolean);
  };
  const lineHasDate = (line) => /(19|20)\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?/.test(line);
  const parseSimpleRecords = (lines, type) => {
    const records = [];
    let current = null;
    const pushCurrent = () => {
      if (current && Object.values(current).some(Boolean)) records.push(current);
      current = null;
    };
    const createRecord = () => {
      if (type === 'languages') return { language: '', level: '', score: '' };
      if (type === 'campusExperience') return { name: '', role: '', start: '', end: '', description: '' };
      return { name: '', date: '', description: '' };
    };

    for (const rawLine of lines) {
      const line = String(rawLine || '').replace(/^[•·\-、\s]+/, '').trim();
      if (!line) {
        pushCurrent();
        continue;
      }
      if (type === 'languages') {
        const pieces = line.split(/[，,、/|]/).map((x) => x.trim()).filter(Boolean);
        if (pieces.length >= 2 && !/[：:]/.test(line)) {
          records.push({ language: pieces[0] || '', level: pieces[1] || '', score: pieces.slice(2).join(' / ') });
          continue;
        }
        const direct = line.match(/^(中文|英语|日语|韩语|法语|德语|西班牙语|俄语|粤语|普通话|英语六级|英语四级|托福|雅思)(?:[:：\s-]+)?(.+)?$/i);
        if (direct) {
          records.push({ language: direct[1] || '', level: (direct[2] || '').trim(), score: '' });
          continue;
        }
        current = current || createRecord();
        if (/^(语言|语种)[:：]/.test(line)) current.language = line.replace(/^(语言|语种)[:：]\s*/, '');
        else if (/^(等级|水平)[:：]/.test(line)) current.level = line.replace(/^(等级|水平)[:：]\s*/, '');
        else if (/^(分数|成绩)[:：]/.test(line)) current.score = line.replace(/^(分数|成绩)[:：]\s*/, '');
        else current.level = [current.level, line].filter(Boolean).join(' / ');
        continue;
      }

      if (type === 'campusExperience') {
        const periodMatch = line.match(/((?:19|20)\d{2}[./-]\d{1,2})(?:\s*(?:-|~|至|到)\s*((?:19|20)\d{2}[./-]\d{1,2}|至今|present))?/i);
        if (periodMatch && (!current || current.name || current.role || current.description)) {
          pushCurrent();
          current = createRecord();
          current.start = normalizeDate(periodMatch[1]);
          current.end = normalizeDate(periodMatch[2] || '');
          const rest = line.replace(periodMatch[0], '').trim();
          const parts = rest.split(/\s{2,}|\t+|\s+/).map((x) => x.trim()).filter(Boolean);
          current.name = parts[0] || '';
          current.role = parts.slice(1).join(' ');
          continue;
        }
        current = current || createRecord();
        if (/^(名称|活动|组织)[:：]/.test(line)) current.name = line.replace(/^(名称|活动|组织)[:：]\s*/, '');
        else if (/^(角色|职位|职务)[:：]/.test(line)) current.role = line.replace(/^(角色|职位|职务)[:：]\s*/, '');
        else if (/^(开始时间)[:：]/.test(line)) current.start = normalizeDate(line.replace(/^开始时间[:：]\s*/, ''));
        else if (/^(结束时间)[:：]/.test(line)) current.end = normalizeDate(line.replace(/^结束时间[:：]\s*/, ''));
        else if (!current.name) current.name = line;
        else if (!current.role && !lineHasDate(line) && line.length <= 24) current.role = line;
        else current.description = [current.description, line].filter(Boolean).join('\n');
        continue;
      }

      // 日期在开头：2021.10 校级一等奖学金
      const dateLead = line.match(new RegExp(`^(${YEAR_MONTH}(?:[./-]\\d{1,2})?)\\s*(.+)$`));
      if (dateLead) {
        pushCurrent();
        current = createRecord();
        current.date = normalizeDate(dateLead[1]);
        current.name = dateLead[2].trim();
        continue;
      }
      const dated = line.match(/^(.*?)\s+((?:19|20)\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?)$/);
      if (dated) {
        pushCurrent();
        current = createRecord();
        current.name = dated[1].trim();
        current.date = normalizeDate(dated[2]);
        continue;
      }
      current = current || createRecord();
      if (/^(成绩|分数|发表于|收录于|描述|说明|负责)/.test(line)) {
        current = current || createRecord();
        current.description = [current.description, line].filter(Boolean).join('\n');
        continue;
      }
      if (current.name && (current.date || current.description) && !/[：:]/.test(line) && !lineHasDate(line) && line.length <= 24) {
        pushCurrent();
        current = createRecord();
        current.name = line;
        continue;
      }
      if (/^(名称|证书|奖项|成果名称|论文|专利)[:：]/.test(line)) current.name = line.replace(/^(名称|证书|奖项|成果名称|论文|专利)[:：]\s*/, '');
      else if (/^(时间|日期|获得时间|发布时间)[:：]/.test(line)) current.date = normalizeDate(line.replace(/^(时间|日期|获得时间|发布时间)[:：]\s*/, ''));
      else if (!current.name) current.name = line;
      else current.description = [current.description, line].filter(Boolean).join('\n');
    }
    pushCurrent();
    return records;
  };
  const saveParsedRecords = (items, fields) => (items || []).filter((item) => Object.values(item || {}).some((value) => String(value || '').trim())).map((item) => fields.map((field) => item[field.key] ? `${field.label}：${item[field.key]}` : '').filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
  const extractModuleProfile = (text) => {
    const fields = {
      certificates: [{ key: 'name', label: '名称' }, { key: 'date', label: '时间' }, { key: 'description', label: '描述' }],
      awards: [{ key: 'name', label: '名称' }, { key: 'date', label: '时间' }, { key: 'description', label: '描述' }],
      academicWorks: [{ key: 'name', label: '成果名称' }, { key: 'date', label: '发布时间' }, { key: 'description', label: '描述' }],
      languages: [{ key: 'language', label: '语言' }, { key: 'level', label: '等级' }, { key: 'score', label: '分数' }],
      campusExperience: [{ key: 'name', label: '名称' }, { key: 'role', label: '角色' }, { key: 'start', label: '开始时间' }, { key: 'end', label: '结束时间' }, { key: 'description', label: '描述' }]
    };
    const result = Object.fromEntries(Object.keys(fields).map((key) => {
      const sectionLines = collectSectionLines(text, key);
      const records = parseSimpleRecords(sectionLines, key);
      return [key, saveParsedRecords(records, fields[key])];
    }));
    const mixedLines = collectSectionLines(text, 'academicWorks');
    if (/(奖项论文专利|论文专利|奖项荣誉|获奖情况)/.test(text)) {
      const awardRecords = [];
      const academicRecords = [];
      const certRecords = [];
      for (const raw of mixedLines) {
        const line = cleanBullet(raw);
        if (!line) continue;
        if (CERT_PREFIX_HINT.test(line) || /CET-?4|CET-?6|教资|教师资格证|软考|计算机等级/.test(line)) certRecords.push(line);
        else if (ACADEMIC_PREFIX_HINT.test(line) || /专利|论文|under review|ICML|AAAI|NeurIPS/i.test(line)) academicRecords.push(line);
        else awardRecords.push(line);
      }
      if (awardRecords.length) result.awards = saveParsedRecords(parseSimpleRecords(awardRecords, 'awards'), fields.awards);
      if (academicRecords.length) result.academicWorks = saveParsedRecords(parseSimpleRecords(academicRecords, 'academicWorks'), fields.academicWorks);
      if (certRecords.length) result.certificates = saveParsedRecords(parseSimpleRecords(certRecords, 'certificates'), fields.certificates);
    }
    return result;
  };
  // 通用小节采集：从匹配 header 的行开始，到下一个任何小节标题为止
  const collectGenericSection = (text, headerRe) => {
    const out = [];
    let active = false;
    for (const rawLine of String(text || '').split(/\n/)) {
      const line = rawLine.trim();
      if (headerRe.test(line)) { active = true; continue; }
      if (active && (isSectionHeader(line) || isExperienceSectionHeader(line) || isModuleHeader(line))) break;
      if (active && line) out.push(line);
    }
    return out;
  };
  const cleanBullet = (line) => {
    const s = String(line || '');
    // 日期开头的行不要剥（获奖/经历的时间会被误删）
    if (new RegExp(`^\\s*(?:${YEAR_MONTH}|(?:19|20)\\d{2}年)`).test(s)) return s.trim();
    return s.replace(/^[•·\-\d.、\s]+/, '').trim();
  };
  const isModuleHeader = (line) => MODULE_HEADER_HINT.test(String(line || '').trim());
  const looksLikeAbilitySummary = (line) => {
    const text = cleanBullet(line);
    if (!text) return false;
    const hasAbility = ABILITY_HINT.test(text) || TOOL_HINT.test(text) || AI_HINT.test(text) || ENGINEERING_HINT.test(text);
    const hasNarrative = PROJECT_NARRATIVE_HINT.test(text);
    const tokenCount = text.split(/[、,，/| ]+/).filter(Boolean).length;
    return hasAbility && (!hasNarrative || tokenCount >= 5);
  };
  const classifyAbility = (line) => {
    const text = cleanBullet(line);
    if (!text) return null;
    if (SKILL_PREFIX_HINT.test(text)) return 'skills';
    if (ADVANTAGE_PREFIX_HINT.test(text)) return 'advantages';
    if (AWARD_PREFIX_HINT.test(text) || CERT_PREFIX_HINT.test(text) || ACADEMIC_PREFIX_HINT.test(text)) return 'other';
    if (TOOL_HINT.test(text)) return 'skills';
    if (AI_HINT.test(text)) return 'advantages';
    if (ENGINEERING_HINT.test(text)) return 'advantages';
    if (/(敏感度|学习能力|沟通能力|协作能力|抗压能力|责任心|自驱力|好奇心|逻辑思维|产品思维|业务理解|快速上手)/.test(text)) return 'advantages';
    return 'other';
  };
  const isExperienceSectionHeader = (line) => /(项目经历|项目经验|项目实践|实习经历|实习经验|工作经历|工作经验|职业经历|实践经历|相关经历|社会经历|项目\/校园经历|项目\/校内经历|校园经历|项目与实习|实习与项目|项目\/实习|实习\/项目|个人项目|开源项目|项目展示)/.test(String(line || '').trim());
  const typeFromExpHeader = (line) => {
    if (/实习/.test(line) && /项目|实践/.test(line)) return 'mixed';
    if (/实习/.test(line)) return 'internship';
    if (/工作|职业|社会|实践|相关/.test(line)) return 'work';
    return 'project';
  };
  const COMPANY_TAIL = /(公司|有限公司|科技|信息|网络|大学|学院|研究院|工作室|集团|银行|证券|事务所|医院|政府|委员会|中心)$/;
  const classifyEntryType = (entry) => {
    if (/实习/.test(`${entry.role || ''} ${entry.title || ''}`)) return 'internship';
    if (COMPANY_TAIL.test(String(entry.company || '').trim())) return 'work';
    return 'project';
  };
  const parsePeriodLine = (line, currentType) => {
    const periodMatch = String(line || '').match(PERIOD_PREFIX_RE);
    if (!periodMatch) return null;
    const period = periodMatch[1].trim();
    const rest = periodMatch[2].trim();
    if (!rest) return null;

    const compactParts = rest.split(/\s{2,}|\t+/).map((x) => x.trim()).filter(Boolean);
    const fallbackParts = rest.split(/\s+/).map((x) => x.trim()).filter(Boolean);
    let parts = compactParts.length >= 2 ? compactParts : fallbackParts;
    if (parts.length < 2) {
      const roleMatch = rest.match(new RegExp(`(.+?)\\s+(${ROLE_TAIL_HINT.source})`, 'i'));
      if (roleMatch) parts = [roleMatch[1].trim(), roleMatch[2].trim()];
    }
    if (parts.length < 2) return null;

    if (currentType === 'project') {
      return {
        type: currentType,
        period,
        title: parts.slice(0, -1).join(' '),
        role: parts[parts.length - 1],
        description: ''
      };
    }

    return {
      type: currentType,
      period,
      company: parts.slice(0, -1).join(' '),
      role: parts[parts.length - 1],
      description: ''
    };
  };
  const parsePeriodTailLine = (line, currentType) => {
    const m = String(line || '').match(PERIOD_TAIL_RE);
    if (!m) return null;
    return parsePeriodLine(`${m[2]} ${m[1]}`, currentType);
  };
  const pushUnique = (arr, value) => {
    const text = cleanBullet(value);
    if (!text) return;
    if (!arr.some((x) => x === text)) arr.push(text);
  };
  const mergeBullets = (base, items) => {
    const all = []
      .concat(String(base || '').split(/\n+/).map((x) => x.trim()).filter(Boolean))
      .concat(items);
    return [...new Set(all)].join('\n').trim();
  };
  const mergeTags = (base, items) => {
    const all = []
      .concat(String(base || '').split(/[,，/|\n]+/).map((x) => x.trim()).filter(Boolean))
      .concat(items);
    return [...new Set(all)].join(' / ').trim();
  };
  const shouldTerminateDescription = (line, current) => {
    if (!current) return false;
    const text = cleanBullet(line);
    if (!text) return false;
    if (isModuleHeader(text)) return true;
    const desc = String(current.description || '');
    if (desc.length > 380 && looksLikeAbilitySummary(text)) return true;
    return false;
  };
  function parseResumeText(rawText) {
    const text = normalizeRawText(rawText).trim();
    const blocks = splitBlocks(text);
    const lines = text.split(/\n/).map((x) => x.trim()).filter(Boolean);
    const headLines = lines.slice(0, 8);
    const guessName = () => {
      for (const line of headLines) {
        const first = (line.split(/[\s|/·,，()]+/).find(Boolean) || '').trim();
        if (/^[\u4e00-\u9fa5·]{2,4}$/.test(first) && !/(简历|求职|应聘|先生|女士|老师|个人)/.test(first) && !EDUCATION_HINT.test(first) && !isSectionHeader(first) && !isModuleHeader(first)) return first;
      }
      return '';
    };
    const guessGender = () => (headLines.join('\n').match(/(?:^|[\s|/·,，(])(男|女)(?=[\s|/·,，)岁]|$)/m) || [])[1] || '';
    const guessBirthday = () => {
      for (const line of lines.slice(0, 5)) {
        const labeled = line.match(/(?:出生日期|出生|生日)[:：]?\s*((?:19|20)\d{2}[./年-]\d{1,2}(?:[./月-]\d{1,2}日?)?)/);
        if (labeled) return normalizeDate(labeled[1]);
        if (/(男|女|岁)/.test(line)) {
          const d = line.match(/((?:19|20)\d{2}[./年-]\d{1,2}(?:[./月-]\d{1,2}日?)?)/);
          if (d) return normalizeDate(d[1]);
        }
      }
      return '';
    };
    const profile = {
      name: pickByRegex(text, /姓名[:：]\s*([^\n]+)/) || guessName(),
      gender: pickByRegex(text, /性别[:：]\s*([^\n]+)/) || guessGender(),
      birthday: normalizeDate(pickByRegex(text, /(?:出生日期|生日)[:：]\s*([^\n]+)/)) || guessBirthday(),
      city: pickByRegex(text, /(?:所在城市|现居地)[:：]\s*([^\n]+)/),
      idType: pickByRegex(text, /证件类型[:：]\s*([^\n]+)/) || '身份证',
      idNumber: pickByRegex(text, /(?:证件号码|身份证号)[:：]\s*([^\n]+)/),
      phone: pickByRegex(text, /(?:手机号|电话|手机|联系电话)[:：]?\s*(1\d{10})/) || pickByRegex(text, /(1\d{10})/),
      email: pickByRegex(text, /(?:邮箱|Email|E-mail|邮件)[:：]?\s*([^\s\n，,；;、]+)/i) || pickByRegex(text, /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/),
      wechat: pickByRegex(text, /(?:微信号|微信|WeChat|wechat|VX)[:：]\s*([^\s，,；;、]+)/),
      github: pickByRegex(text, /(?:GitHub|Github|GITHUB)[:：]\s*((?:https?:\/\/)?[^\s，,；;、)\]]+)/) || pickByRegex(text, /((?:https?:\/\/)?(?:www\.)?github\.com\/[^\s，,；;、)\]]+)/i),
      homepage: pickByRegex(text, /(?:个人主页|个人博客|个人空间|个人站点|博客|主页)[:：]\s*([^\s，,；;、)\]]+)/) || pickByRegex(text, /((?:https?:\/\/)?[\w-]+\.github\.io[^\s，,；;、)\]]*)/i),
      portfolio: pickByRegex(text, /(?:个人作品集网站|作品集网站|个人作品网站|作品集链接|作品网站|作品集|作品链接|个人作品)[:：]\s*([^\s，,；;、)\]]+)/),
      website: pickByRegex(text, /(?:个人网址|个人网站|网址|网站)[:：]\s*([^\s，,；;、)\]]+)/),
      linkedin: pickByRegex(text, /(?:LinkedIn|领英)[:：]?\s*((?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s，,；;、)\]]+)/i),
      nativePlace: pickByRegex(text, /籍贯[:：]\s*([^\n]+)/),
      politicalStatus: pickByRegex(text, /政治面貌[:：]\s*([^\n]+)/),
      address: pickByRegex(text, /(?:现居地址|居住地址|联系地址|通讯地址)[:：]\s*([^\n]+)/),
      jobIntent: pickByRegex(text, /(?:求职意向|意向岗位|期望职位|应聘岗位|应聘职位|求职岗位|应聘)[:：]\s*([^\n]+)/),
      expectedCity: pickByRegex(text, /(?:期望城市|期望工作城市|意向城市|期望地点|期望工作地点)[:：]\s*([^\n]+)/),
      expectedSalary: pickByRegex(text, /(?:期望薪资|薪资要求|期望薪水|期望月薪|期望年薪|期望待遇)[:：]\s*([^\n]+)/),
      availableDate: pickByRegex(text, /(?:到岗时间|可到岗时间|可到职时间|入职时间)[:：]\s*([^\n]+)/),
      emergencyContact: pickByRegex(text, /紧急联系人[:：]\s*([^\n]+)/),
      emergencyPhone: pickByRegex(text, /紧急联系方式[:：]\s*([^\n]+)/),
      skills: '',
      advantages: '',
      otherInfo: '',
      ...parseEducation(text, blocks)
    };

    const skillsBucket = [];
    const advantagesBucket = [];
    const otherBucket = [];
    const collectAbilityLine = (line) => {
      const text = cleanBullet(line);
      if (!text || isModuleHeader(text)) return;
      const group = classifyAbility(text);
      if (group === 'skills') pushUnique(skillsBucket, text);
      else if (group === 'advantages') pushUnique(advantagesBucket, text);
      else pushUnique(otherBucket, text);
    };

    const pushDedupe = (bucket, item) => {
      if (item && Object.values(item).some(Boolean)) {
        if (item.type === 'mixed') item.type = classifyEntryType(item);
        // 字段错位纠正：项目要有 title，实习/工作要有 company
        if (item.type === 'project' && !item.title && item.company) { item.title = item.company; item.company = ''; }
        if ((item.type === 'internship' || item.type === 'work') && !item.company && item.title) { item.company = item.title; item.title = ''; }
        bucket.push(item);
      }
      return null;
    };
    const dedupe = (items) => {
      const seen = new Set();
      return items.filter((item) => {
        // 双键：全字段一致 或 时间段+描述前缀一致（不同策略产出字段结构不同也算重复）
        const keys = [
          [item.type, item.title, item.company, item.role, item.start, item.end, item.description].join('|'),
          `d|${item.start}|${item.end}|${String(item.description || '').slice(0, 16)}`
        ];
        if (keys.some((k) => seen.has(k))) return false;
        keys.forEach((k) => seen.add(k));
        return true;
      });
    };
    const parseTimelineStrategy = () => {
      const out = [];
      let currentType = 'project';
      let inExperienceSection = false;
      let current = null;
      let pendingPeriod = '';
      const flush = () => { current = pushDedupe(out, current); };
      for (const line of lines) {
        if (isModuleHeader(line)) { flush(); inExperienceSection = false; pendingPeriod = ''; continue; }
        if (EDUCATION_HINT.test(line) && !isExperienceSectionHeader(line)) continue;
        if (shouldTerminateDescription(line, current)) { flush(); collectAbilityLine(line); continue; }
        if (!current && looksLikeAbilitySummary(line)) { collectAbilityLine(line); continue; }
        if (isExperienceSectionHeader(line)) { currentType = typeFromExpHeader(line); inExperienceSection = true; flush(); pendingPeriod = ''; continue; }
        if (isSectionHeader(line)) { flush(); inExperienceSection = false; pendingPeriod = ''; continue; }
        if (!inExperienceSection) continue;
        // 独立日期行：存起来等下一行公司/项目名
        if (PERIOD_ONLY_RE.test(line)) { flush(); pendingPeriod = line; continue; }
        if (pendingPeriod) {
          const combo = parsePeriodLine(`${pendingPeriod} ${line}`, currentType);
          if (combo) {
            if (EDUCATION_HINT.test(combo.title || '') || EDUCATION_HINT.test(combo.company || '')) { pendingPeriod = ''; continue; }
            flush();
            current = withPeriodDates(combo);
            pendingPeriod = '';
            continue;
          }
          if (line.length <= 40 && !/[:：]/.test(line)) {
            flush();
            const entry = { type: currentType, title: currentType === 'project' ? line : '', company: currentType === 'project' ? '' : line, role: '', period: pendingPeriod, description: '' };
            current = withPeriodDates(entry);
            pendingPeriod = '';
            continue;
          }
          pendingPeriod = '';
        }
        const periodLine = parsePeriodLine(line, currentType) || parsePeriodTailLine(line, currentType);
        if (periodLine) {
          if (EDUCATION_HINT.test(periodLine.title || '') || EDUCATION_HINT.test(periodLine.company || '') || EDUCATION_HINT.test(periodLine.role || '')) continue;
          flush();
          current = withPeriodDates(periodLine);
          continue;
        }
        if (/^[•·\-]/.test(line) || current) {
          if (!current) current = { type: currentType, title: '', company: '', role: '', start: '', end: '', description: '' };
          current.description = `${current.description}${current.description ? '\n' : ''}${line.replace(/^[•·\-]\s*/, '')}`;
        }
      }
      flush();
      return out;
    };
    const parseLabeledStrategy = () => {
      const out = [];
      let currentType = 'project';
      let inExperienceSection = false;
      let current = null;
      for (const line of lines) {
        if (isExperienceSectionHeader(line)) { current = pushDedupe(out, current); currentType = typeFromExpHeader(line); inExperienceSection = true; continue; }
        if (isSectionHeader(line)) { current = pushDedupe(out, current); inExperienceSection = false; continue; }
        if (!inExperienceSection) continue;
        if (isModuleHeader(line)) { current = pushDedupe(out, current); inExperienceSection = false; continue; }
        const mini = line.match(/^(公司名称|公司|项目名称|项目|职位|岗位|角色|开始时间|起始时间|结束时间|截止时间|起止时间|时间周期|时间|描述|工作内容|项目描述|工作职责|项目职责)[:：]\s*(.+)$/);
        if (!mini) continue;
        const keyMap = { 公司名称: 'company', 公司: 'company', 项目名称: 'title', 项目: 'title', 职位: 'role', 岗位: 'role', 角色: 'role', 开始时间: 'start', 起始时间: 'start', 结束时间: 'end', 截止时间: 'end', 起止时间: 'period', 时间周期: 'period', 时间: 'period', 描述: 'description', 工作内容: 'description', 项目描述: 'description', 工作职责: 'description', 项目职责: 'description' };
        const key = keyMap[mini[1]];
        const value = /^(开始时间|起始时间|结束时间|截止时间)$/.test(mini[1]) ? normalizeDate(mini[2]) : mini[2].trim();
        if ((key === 'company' || key === 'title') && current && (current.company || current.title)) current = pushDedupe(out, current);
        if (!current) current = { type: currentType, title: '', company: '', role: '', start: '', end: '', description: '' };
        current[key] = key === 'description' && current.description ? `${current.description}\n${value}` : value;
      }
      current = pushDedupe(out, current);
      return out;
    };
    const looksLikeCompanyLine = (line) => {
      const text = String(line || '').trim();
      if (!text || text.length > 42 || /[:：]/.test(text) || new RegExp(`^${YEAR_MONTH}`).test(text)) return false;
      return /(公司|有限公司|科技|信息|网络|大学|学院|研究院|工作室|集团)$/.test(text) || /（.*?）$/.test(text);
    };
    const looksLikeRoleLine = (line) => {
      const text = String(line || '').trim();
      return !!text && text.length <= 24 && !/[:：]/.test(text) && ROLE_TAIL_HINT.test(text);
    };
    const parseCompanyBlockStrategy = () => {
      const out = [];
      let currentType = 'project';
      let inExperienceSection = false;
      let current = null;
      for (const line of lines) {
        if (isExperienceSectionHeader(line)) { current = pushDedupe(out, current); currentType = typeFromExpHeader(line); inExperienceSection = true; continue; }
        if (isSectionHeader(line)) { current = pushDedupe(out, current); inExperienceSection = false; continue; }
        if (!inExperienceSection) continue;
        if (isModuleHeader(line)) { current = pushDedupe(out, current); inExperienceSection = false; continue; }
        if (PERIOD_ONLY_RE.test(line)) continue;
        if (parsePeriodLine(line, currentType)) continue;
        // 尾部带日期的公司/项目行：剥出日期建条目
        const tail = line.match(PERIOD_TAIL_RE);
        if (tail) {
          const base = tail[1].trim();
          if (base && base.length <= 42 && !/[:：]/.test(base)) {
            current = pushDedupe(out, current);
            const entry = { type: currentType, title: currentType === 'project' ? base : '', company: currentType === 'project' ? '' : base, role: '', period: tail[2], description: '' };
            current = withPeriodDates(entry);
            continue;
          }
        }
        if (looksLikeCompanyLine(line)) { current = pushDedupe(out, current); current = { type: currentType, title: '', company: line, role: '', start: '', end: '', description: '' }; continue; }
        if (current && !current.role && looksLikeRoleLine(line)) { current.role = line; continue; }
        if (current) current.description = `${current.description}${current.description ? '\n' : ''}${line.replace(/^[•·\-]\s*/, '')}`;
      }
      current = pushDedupe(out, current);
      return out;
    };
    const experiences = dedupe([].concat(parseLabeledStrategy(), parseTimelineStrategy(), parseCompanyBlockStrategy()));
    profile.skills = mergeTags(profile.skills, skillsBucket);
    profile.advantages = mergeBullets(profile.advantages, advantagesBucket);
    profile.otherInfo = mergeBullets(profile.otherInfo, otherBucket);
    Object.assign(profile, extractModuleProfile(text));

    // 技能专区：整段按分隔符拆成标签（不再依赖碰巧路过）
    const skillSectionLines = collectGenericSection(text, /^(专业技能|技能|技能与工具|技术栈|技能总结|专业能力|专业技能与优势|技能优势)(?:[:：]?\s*)$/i);
    if (skillSectionLines.length) {
      const tokens = skillSectionLines
        .flatMap((l) => cleanBullet(l).replace(/^(专业技能|技能|技术栈|技能与工具|编程语言|数据库|框架|开发工具|工具)[:：]\s*/, '').split(/[,，、/|·;；]+/))
        .map((x) => x.trim())
        .filter((x) => x && x.length <= 30 && !lineHasDate(x));
      profile.skills = mergeTags(profile.skills, tokens);
    }
    // 自我评价/个人优势专区
    const advantageSectionLines = collectGenericSection(text, /^(自我评价|个人总结|个人评价|个人优势|核心优势|综合能力|自我介绍)(?:[:：]?\s*)$/i);
    if (advantageSectionLines.length) {
      const items = advantageSectionLines
        .map((l) => cleanBullet(l).replace(/^(自我评价|个人总结|个人评价|个人优势|综合能力|自我介绍)[:：]\s*/, ''))
        .filter(Boolean);
      profile.advantages = mergeBullets(profile.advantages, items);
    }
    // 证书兜底：全文扫描常见证书写法（语言小节里出现的除外）
    if (!profile.certificates) {
      const langSectionText = collectSectionLines(text, 'languages').join('\n');
      const certLines = lines
        .map((l) => cleanBullet(l))
        .filter((l) => l && l.length <= 60 && /CET-?[46]|英语四级|英语六级|普通话|计算机(等级|二级|三级|四级)|教师资格证|软考|雅思|托福|TOEFL|IELTS|驾驶证|证券从业|基金从业|会计从业|法律职业|注册会计师|CPA/i.test(l))
        .filter((l) => !langSectionText.includes(l));
      if (certLines.length) profile.certificates = certLines.map((l) => `名称：${l}`).join('\n\n');
    }
    return { profile, experiences, rawText: text, blocks };
  }
  function decodeXmlText(xml) {
    return String(xml || '')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<w:cr\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  async function extractDocxTextWithZip(arrayBuffer) {
    const JSZipLib = globalThis.JSZip || window.JSZip;
    if (!JSZipLib?.loadAsync) throw new Error('JSZip not available');
    const zip = await JSZipLib.loadAsync(arrayBuffer);
    const documentXml = zip.file('word/document.xml');
    if (!documentXml) throw new Error('word/document.xml not found');
    const xml = await documentXml.async('text');
    return decodeXmlText(xml);
  }
  const parseRecords = (value, fields) => splitBlocks(value).map((block) => {
    const rec = {};
    fields.forEach((f) => { rec[f.key] = f.key === 'description' ? ((block.match(/描述[:：]\s*([\s\S]+)/) || [])[1] || '').trim() : ((block.match(new RegExp(`${f.label}[:：]\\s*([^\\n]+)`)) || [])[1] || '').trim(); });
    return rec;
  }).filter((rec) => Object.values(rec).some(Boolean));
  const saveRecords = (items, fields) => items.filter((it) => Object.values(it || {}).some((v) => String(v || '').trim())).map((it) => fields.map((f) => it[f.key] ? `${f.label}：${it[f.key]}` : '').filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
  const cloneRecordList = (list) => (Array.isArray(list) ? list.map((item) => ({ ...(item || {}) })) : []);
  const moduleState = (editable) => {
    const drafts = editable.moduleDrafts || {};
    return {
      skills: Array.isArray(drafts.skills) ? [...drafts.skills] : tags(editable.profile.skills),
      advantages: Array.isArray(drafts.advantages) ? [...drafts.advantages] : bullets(editable.profile.advantages),
      otherInfo: Array.isArray(drafts.otherInfo) ? [...drafts.otherInfo] : bullets(editable.profile.otherInfo),
      certificates: Array.isArray(drafts.certificates) ? cloneRecordList(drafts.certificates) : parseRecords(editable.profile.certificates, byKey(MODULES, 'certificates').fields),
      awards: Array.isArray(drafts.awards) ? cloneRecordList(drafts.awards) : parseRecords(editable.profile.awards, byKey(MODULES, 'awards').fields),
      academicWorks: Array.isArray(drafts.academicWorks) ? cloneRecordList(drafts.academicWorks) : parseRecords(editable.profile.academicWorks, byKey(MODULES, 'academicWorks').fields),
      languages: Array.isArray(drafts.languages) ? cloneRecordList(drafts.languages) : parseRecords(editable.profile.languages, byKey(MODULES, 'languages').fields),
      campusExperience: Array.isArray(drafts.campusExperience) ? cloneRecordList(drafts.campusExperience) : parseRecords(editable.profile.campusExperience, byKey(MODULES, 'campusExperience').fields)
    };
  };
  const syncModules = (editable, state) => {
    editable.profile.skills = saveTags(state.skills || []); editable.profile.advantages = saveBullets(state.advantages || []); editable.profile.otherInfo = saveBullets(state.otherInfo || []);
    ['certificates','awards','academicWorks','languages','campusExperience'].forEach((key) => editable.profile[key] = saveRecords(state[key] || [], byKey(MODULES, key).fields));
    editable.moduleDrafts = {
      skills: [...(state.skills || [])],
      advantages: [...(state.advantages || [])],
      otherInfo: [...(state.otherInfo || [])],
      certificates: cloneRecordList(state.certificates || []),
      awards: cloneRecordList(state.awards || []),
      academicWorks: cloneRecordList(state.academicWorks || []),
      languages: cloneRecordList(state.languages || []),
      campusExperience: cloneRecordList(state.campusExperience || [])
    };
  };
  const withDefaults = (parsed) => ({ profile: { ...Object.fromEntries(BASIC_FIELDS.map((f) => [f.key, ''])), advantages:'',skills:'',certificates:'',awards:'',academicWorks:'',languages:'',campusExperience:'',otherInfo:'', ...(parsed.profile || {}) }, experiences: { internship:[], project:[], work:[], ...Object.fromEntries(EXP_GROUPS.map((g) => [g.key, []])) }, moduleDrafts: {}, customFields: [] });
  // 导入合并：简历里有的字段才覆盖（命中的项），简历没有的字段保留手动填写的内容
  function mergeImportedEditable(prev, next) {
    const merged = next;
    const keepIfEmpty = (key) => { if (!filled(next.profile[key])) merged.profile[key] = prev.profile[key] || ''; };
    BASIC_FIELDS.forEach((f) => keepIfEmpty(f.key));
    // 经历：按 公司/项目名 匹配条目，匹配的字段级合并（简历非空才覆盖），没匹配的保留手动条目
    EXP_GROUPS.forEach((group) => {
      const prevItems = prev.experiences[group.key] || [];
      const used = new Set();
      const keyOf = (x) => String(x.company || x.title || '').replace(/\s+/g, '').toLowerCase();
      merged.experiences[group.key] = (next.experiences[group.key] || []).map((item) => {
        const k = keyOf(item);
        const idx = k ? prevItems.findIndex((p, i) => !used.has(i) && keyOf(p) === k) : -1;
        if (idx < 0) return item;
        used.add(idx);
        const out = { ...item };
        group.fields.forEach((f) => { if (!filled(item[f.key])) out[f.key] = prevItems[idx][f.key] || ''; });
        return out;
      });
      prevItems.forEach((p, i) => { if (!used.has(i) && Object.values(p).some((v) => filled(v))) merged.experiences[group.key].push(p); });
    });
    // 模块草稿：tags/bullets 按文本并集；records 按首字段（名称/语言）匹配合并
    const prevDrafts = prev.moduleDrafts || {};
    const nextDrafts = next.moduleDrafts || {};
    MODULES.forEach((mod) => {
      const prevList = Array.isArray(prevDrafts[mod.key]) ? prevDrafts[mod.key] : [];
      const nextList = Array.isArray(nextDrafts[mod.key]) ? nextDrafts[mod.key] : [];
      if (mod.kind === 'tags' || mod.kind === 'bullets') {
        const seen = new Set(nextList.map((x) => String(x).trim().toLowerCase()));
        merged.moduleDrafts[mod.key] = [...nextList, ...prevList.filter((x) => filled(x) && !seen.has(String(x).trim().toLowerCase()))];
        return;
      }
      const firstKey = mod.fields[0].key;
      const keyOf = (x) => String(x[firstKey] || '').replace(/\s+/g, '').toLowerCase();
      const used = new Set();
      const out = nextList.map((rec) => {
        const k = keyOf(rec);
        const idx = k ? prevList.findIndex((p, i) => !used.has(i) && keyOf(p) === k) : -1;
        if (idx < 0) return rec;
        used.add(idx);
        const mergedRec = { ...rec };
        mod.fields.forEach((f) => { if (!filled(rec[f.key])) mergedRec[f.key] = prevList[idx][f.key] || ''; });
        return mergedRec;
      });
      prevList.forEach((p, i) => { if (!used.has(i) && Object.values(p).some((v) => filled(v))) out.push(p); });
      merged.moduleDrafts[mod.key] = out;
    });
    // 扩展字段是手动创建的，简历里没有对应概念：整条保留手动数据
    merged.customFields = Array.isArray(prev.customFields) ? prev.customFields : [];
    // 由合并后的草稿重新生成 profile 里的模块文本（技能标签/证书等）
    syncModules(merged, moduleState(merged));
    return merged;
  }
  function buildEditable(parsed) { const editable = withDefaults(parsed || {}); (parsed.experiences || []).forEach((x) => { const text = `${x.title || ''} ${x.company || ''} ${x.role || ''} ${x.description || ''}`; const forcedProject = /(自主项目|个人项目|side project)/i.test(text); const type = forcedProject ? 'project' : (x.type || 'project'); editable.experiences[type].push({ title:x.title||'', role:x.role||'', company:x.company||'', start:x.start||'', end:x.end||'', description:x.description||'' }); }); editable.moduleDrafts = moduleState(editable); return editable; }
  function flattenEditable(editable) {
    const result = BASIC_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      value: editable.profile?.[field.key] || ''
    })).filter((item) => item.value);

    MODULES.forEach((module) => {
      const value = editable.profile?.[module.key] || '';
      if (value) result.push({ key: module.key, label: module.label, value });
    });

    (editable.customFields || []).forEach((cf, i) => {
      const content = String(cf?.content || '').trim();
      if (!content) return;
      result.push({ key: `custom_${i}`, label: String(cf?.title || '').trim() || `扩展字段${i + 1}`, value: content });
    });

    EXP_GROUPS.forEach((group) => {
      (editable.experiences[group.key] || []).forEach((item, index) => {
        result.push({
          key: `${group.key}_${index + 1}_block`,
          label: `${group.label}${index + 1}`,
          group: true,
          children: group.fields.map((field) => ({
            key: `${group.key}_${index + 1}_${field.key}`,
            label: field.label,
            value: item[field.key] || ''
          }))
        });
      });
    });

    return result.filter((item) => item.group ? item.children?.some((child) => child.value) : item.value);
  }
  // 存储数据兜底清洗：老版本的 resumeEditable 可能缺字段/结构过时，
  // 直接渲染会抛异常导致视图卡死。这里一律合并到默认结构上。
  function normalizeEditable(raw) {
    const base = withDefaults({});
    if (!raw || typeof raw !== 'object') return base;
    if (raw.profile && typeof raw.profile === 'object') base.profile = { ...base.profile, ...raw.profile };
    if (raw.experiences && typeof raw.experiences === 'object' && !Array.isArray(raw.experiences)) {
      EXP_GROUPS.forEach((g) => { base.experiences[g.key] = Array.isArray(raw.experiences[g.key]) ? raw.experiences[g.key] : []; });
    }
    if (raw.moduleDrafts && typeof raw.moduleDrafts === 'object') base.moduleDrafts = raw.moduleDrafts;
    if (Array.isArray(raw.customFields)) base.customFields = raw.customFields;
    return base;
  }
  async function getState() { const data = await chrome.storage.local.get(STORAGE_KEYS); const parsed = data.resumeParsed || { profile:{}, experiences:[], rawText:'' }; const editable = data.resumeEditable ? normalizeEditable(data.resumeEditable) : buildEditable(parsed); return { parsed, editable, flattened: data.resumeFlattened || flattenEditable(editable) }; }
  async function persist(editable, options = {}) { if (options.skipRender || currentView === 'edit') skipStorageRenderCount += 1; const parsed = { profile: { ...editable.profile }, experiences: EXP_GROUPS.flatMap((g) => (editable.experiences[g.key] || []).filter((x) => Object.values(x).some(Boolean)).map((x) => ({ ...x, type:g.key, typeLabel:g.label }))), rawText: '' }; await chrome.storage.local.set({ resumeEditable: editable, resumeParsed: parsed, resumeFlattened: flattenEditable(editable), resumeUpdatedAt: Date.now() }); }
  const isEditable = (el) => el && (el.isContentEditable || el.tagName?.toLowerCase() === 'textarea' || (el.tagName?.toLowerCase() === 'input' && !['checkbox','radio','button','submit','file'].includes(el.type)));
  document.addEventListener('focusin', (e) => { const t = e.target; if (t instanceof HTMLElement && !t.closest(`#${PANEL_ID}`) && isEditable(t)) lastActiveEditable = t; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panelVisible = false; updatePanelVisibility(); } });
  chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'RESUME_PANEL_OPEN') return ensurePanel().then(() => { panelVisible = true; updatePanelVisibility(); return { ok: true }; }); if (message?.type === 'RESUME_PANEL_HIDE') { panelVisible = false; updatePanelVisibility(); return Promise.resolve({ ok: true }); } });
  function setNativeValue(el, value) { const proto = Object.getPrototypeOf(el); const desc = Object.getOwnPropertyDescriptor(proto, 'value'); if (desc?.set) desc.set.call(el, value); else el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  async function copyValue(value) { try { await navigator.clipboard.writeText(value); return true; } catch { try { const ta = document.createElement('textarea'); ta.value = value; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch { return false; } } }
  function toast(msg, isError = false) {
    const panel = document.getElementById(PANEL_ID);
    const host = panel || document.body;
    const tip = document.createElement('div');
    tip.className = `raf-tip${isError ? ' err' : ''}`;
    tip.textContent = msg;
    host.appendChild(tip);
    if (panel) {
      // 面板内堆叠，避免多条提示互相遮挡
      const index = panel.querySelectorAll(':scope > .raf-tip').length - 1;
      tip.style.top = `${12 + Math.max(0, index) * 48}px`;
    }
    if (!isError) { setTimeout(() => tip.remove(), 1800); return; }
    // 错误提示：常驻显示，点击复制错误内容并关闭
    tip.classList.add('sticky');
    const hint = document.createElement('span');
    hint.className = 'raf-tip-hint';
    hint.textContent = '（点击复制并关闭）';
    tip.appendChild(hint);
    tip.addEventListener('click', async () => {
      await copyValue(msg);
      tip.remove();
    });
  }
  // 进度提示：持续显示直到 done/fail，不会被点掉也不会自动消失
  // global=true 时挂到页面 body（fixed 定位），不随面板状态波动——长时间任务（如自动填充）必须用 global
  function toastProgress(msg, { global = false } = {}) {
    const panel = document.getElementById(PANEL_ID);
    const host = global ? document.body : (panel || document.body);
    const tip = document.createElement('div');
    tip.className = 'raf-tip progress';
    tip.textContent = msg;
    host.appendChild(tip);
    if (!global && panel) {
      const index = panel.querySelectorAll(':scope > .raf-tip').length - 1;
      tip.style.top = `${12 + Math.max(0, index) * 48}px`;
    }
    return {
      update(nextMsg) {
        tip.textContent = nextMsg;
      },
      done(finalMsg) {
        tip.classList.remove('progress');
        tip.classList.add('ok');
        tip.textContent = finalMsg;
        setTimeout(() => tip.remove(), 3000);
      },
      fail(errMsg) {
        tip.classList.remove('progress');
        tip.classList.add('err', 'sticky');
        tip.textContent = errMsg;
        const hint = document.createElement('span');
        hint.className = 'raf-tip-hint';
        hint.textContent = '（点击复制并关闭）';
        tip.appendChild(hint);
        tip.addEventListener('click', async () => { await copyValue(errMsg); tip.remove(); });
      }
    };
  }
  function setImportDebug(lines) { importDebug = lines; if (listRoot && (currentView === 'preview' || currentView === 'settings')) renderCurrentView(listRoot, { preserveScroll: true }); }
  // 提示音：WebAudio 合成，无需音频文件。complete=全部填入 / partial=部分未填 / fail=填入失败
  let audioCtx = null;
  function playTone(freq, startAt, duration, type = 'sine', volume = 0.5) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const level = volume * Math.max(0, Math.min(100, soundVolume)) / 100;
    if (level <= 0.001) return;
    const t = audioCtx.currentTime + startAt;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }
  function playFeedbackSound(kind) {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const schedule = () => {
        if (kind === 'complete') {
          playTone(523.25, 0, 0.12); playTone(659.25, 0.1, 0.12); playTone(783.99, 0.2, 0.24);
        } else if (kind === 'partial') {
          playTone(659.25, 0, 0.12); playTone(523.25, 0.12, 0.22);
        } else {
          playTone(233.08, 0, 0.18, 'square', 0.3); playTone(174.61, 0.16, 0.3, 'square', 0.3);
        }
      };
      // 异步填充结束时用户手势早已过期，resume 是 promise：恢复成功后才排音
      if (audioCtx.state === 'suspended') audioCtx.resume().then(schedule).catch(() => {});
      else schedule();
    } catch {}
  }
  // 在用户点击「自动填充」的手势生效期内提前激活音频，结束时才能出声
  function primeFeedbackAudio() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch {}
  }
  function updatePanelVisibility() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.style.display = panelVisible ? 'block' : 'none';
    if (panelVisible) clampPanelIntoViewport(panel);
  }
  function applyPanelBrightness(panel, value) { panelBrightness = Math.max(70, Math.min(130, Number(value) || 100)); if (panel) panel.style.setProperty('--raf-panel-brightness', `${panelBrightness}%`); }
  function applyPanelOpacity(panel, value) { panelOpacity = Math.max(0, Math.min(100, Number(value) || 0)); if (panel) panel.style.setProperty('--raf-surface-opacity-level', String(panelOpacity / 100)); }
  function applyGlassSaturation(panel, value) {
    const parsed = Number(value);
    glassSaturation = Math.max(0, Math.min(10000, Number.isFinite(parsed) ? parsed : 20));
    if (!panel) return;
    panel.style.setProperty('--raf-glass-color-level', String(glassSaturation));
  }
  function syncPanelLayout(panel) {
    if (!panel) return;
    const head = panel.querySelector('.raf-head');
    if (!head) return;
    const headHeight = head.offsetHeight || 98;
    panel.style.setProperty('--raf-head-height', `${headHeight}px`);
  }
  function clampPanelIntoViewport(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const isFixed = panel.style.position !== 'absolute';
    const minLeft = margin;
    const maxLeft = Math.max(minLeft, window.innerWidth - rect.width - margin);
    const minTop = isFixed ? margin : window.scrollY + margin;
    const maxTop = isFixed
      ? Math.max(minTop, window.innerHeight - rect.height - margin)
      : Math.max(minTop, window.scrollY + window.innerHeight - rect.height - margin);
    const left = Math.max(minLeft, Math.min(maxLeft, panel.offsetLeft));
    const top = Math.max(minTop, Math.min(maxTop, panel.offsetTop));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }
  function normalizeWidthPercent(value) {
    const numeric = Number(value);
    if (!numeric) return PANEL_WIDTH_PERCENT_MIN;
    if (numeric > 200) return Math.round((numeric / PANEL_WIDTH_BASE) * 100);
    return Math.round(numeric);
  }
  function normalizeHeightPercent(value) {
    const numeric = Number(value);
    if (!numeric) return 100;
    if (numeric > 300) return Math.round((numeric / PANEL_HEIGHT_BASE) * 100);
    return Math.round(numeric);
  }
  function toUiPercent(value, min, max) {
    const clamped = Math.max(min, Math.min(max, Number(value) || min));
    return Math.round(((clamped - min) / (max - min)) * 100);
  }
  function fromUiPercent(value, min, max) {
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    return Math.round(min + ((max - min) * clamped) / 100);
  }
  function applyPanelSize(panel, widthPercent, heightPercent) {
    panelWidthPercent = Math.max(PANEL_WIDTH_PERCENT_MIN, Math.min(PANEL_WIDTH_PERCENT_MAX, normalizeWidthPercent(widthPercent)));
    panelHeightPercent = Math.max(PANEL_HEIGHT_PERCENT_MIN, Math.min(PANEL_HEIGHT_PERCENT_MAX, normalizeHeightPercent(heightPercent)));
    if (panel) {
      panel.style.setProperty('--raf-panel-width', `${Math.round((PANEL_WIDTH_BASE * panelWidthPercent) / 100)}px`);
      panel.style.setProperty('--raf-panel-height', `${Math.round((PANEL_HEIGHT_BASE * panelHeightPercent) / 100)}px`);
      requestAnimationFrame(() => syncPanelLayout(panel));
    }
  }
  // ===== 自动填充：扫描页面表单 → 本地关键词匹配 → AI 兜底 → 写入并高亮 =====
  const AUTOFILL_FILL_CLASS = 'raf-autofill-filled';
  const AUTOFILL_MISS_CLASS = 'raf-autofill-missed';
  // 命中时取「最长关键词」得分最高的规则；分数相同排前面的规则优先
  const AUTOFILL_RULES = [
    { key: 'emergencyPhone', words: ['紧急联系电话', '紧急联系方式'] },
    { key: 'emergencyContact', words: ['紧急联系人'] },
    { key: 'idType', words: ['证件类型'] },
    { key: 'idNumber', words: ['证件号码', '证件号', '身份证号', '身份证', 'idnumber', 'id number'] },
    { key: 'phone', words: ['手机号码', '手机号', '联系电话', '联系方式', '电话', '手机', 'mobile', 'phone', 'tel'], block: ['紧急', '证明'] },
    { key: 'email', words: ['电子邮箱', '电子邮件', '邮箱', 'email', 'e-mail', 'mail'] },
    { key: 'name', words: ['真实姓名', '姓名', '名字', 'fullname', 'full name', 'realname', 'name'], block: ['用户名', '昵称', 'nickname', 'username', '公司', '企业', '学校', 'company', 'school', '项目', 'project', '紧急', '证明', '联系人', '导师'] },
    { key: 'gender', words: ['性别', 'gender', 'sex'] },
    { key: 'birthday', words: ['出生日期', '出生年月', '生日', '出生', 'birthday', 'birth', 'date of birth'] },
    { key: 'nativePlace', words: ['籍贯'] },
    { key: 'politicalStatus', words: ['政治面貌'] },
    { key: 'expectedCity', words: ['期望城市', '意向城市', '工作城市'] },
    { key: 'city', words: ['所在城市', '现居城市', '居住城市', '城市', 'city', 'location'] },
    { key: 'address', words: ['现居地址', '居住地址', '详细地址', '通讯地址', '联系地址', '地址', 'address'] },
    { key: 'expectedSalary', words: ['期望薪资', '薪资要求', '期望月薪', '期望年薪', '薪资', '月薪', '年薪', 'salary'] },
    { key: 'availableDate', words: ['最早可入职', '可入职时间', '可到岗时间', '期望入职时间', '到岗时间', '最快到岗', '可到岗'] },
    { key: 'jobIntent', words: ['求职意向', '意向岗位', '意向职位', '期望职位', '应聘职位', '应聘岗位', '申请职位'] },
    { key: 'degree', words: ['最高学历', '学历', '学位', 'degree'] },
    { key: 'school', words: ['毕业院校', '毕业学校', '就读学校', '学校', '院校', 'university', 'school'], block: ['绩点', '满绩', '排名'] },
    { key: 'college', words: ['院系', '学院', 'college'] },
    { key: 'major', words: ['所学专业', '专业', 'major'] },
    { key: 'educationStart', words: ['入学时间', '入学日期'] },
    { key: 'educationEnd', words: ['毕业时间', '毕业日期'] },
    { key: 'mainCourses', words: ['主修课程', '主修', 'courses'] },
    { key: 'wechat', words: ['微信号', '微信', 'wechat', 'weixin'] },
    { key: 'github', words: ['github'] },
    { key: 'linkedin', words: ['linkedin', '领英'] },
    { key: 'portfolio', words: ['作品集', 'portfolio'] },
    { key: 'homepage', words: ['个人主页', '个人博客', '博客', '主页', 'homepage', 'blog'] },
    { key: 'website', words: ['个人网站', '个人网址', '网址', 'website'] },
    { key: 'skills', words: ['技能标签', '专业技能', '技能', 'skills', 'skill'] },
    { key: 'advantages', words: ['自我评价', '个人优势', '自我介绍', '个人简介', '自我描述', '个人评价', 'about me', 'summary'] },
    // ===== 经历块字段（实习/工作/项目共用，填哪段由块聚类决定） =====
    { key: 'expCompany', words: ['公司名称', '单位名称', '企业名称', '实习单位', '工作单位', '所在公司', '公司', '单位', 'company'], block: ['紧急', '联系'] },
    { key: 'expTitle', words: ['项目名称', '项目名', 'project name', 'project'] },
    { key: 'expRole', words: ['担任职位', '职位名称', '岗位名称', '担任角色', '职位', '岗位', '角色', 'position', 'role'] },
    { key: 'expStart', words: ['开始时间', '起始时间', '开始日期', '入职时间', '起止时间', '任职时间', '在校时间', '实习时间', '项目时间', '工作时间', '就读时间', 'start'], block: ['最早可入职', '可入职', '可到岗', '到岗', '最早'] },
    { key: 'expEnd', words: ['结束时间', '结束日期', '离职时间', '截止时间', 'end'] },
    { key: 'expDesc', words: ['工作描述', '工作内容', '岗位职责', '职责描述', '工作职责', '职责', '项目描述', '实习描述', '经历描述', '描述', 'description'] }
  ];
  function clearAutofillHighlights() {
    document.querySelectorAll(`.${AUTOFILL_FILL_CLASS}, .${AUTOFILL_MISS_CLASS}`).forEach((el) => el.classList.remove(AUTOFILL_FILL_CLASS, AUTOFILL_MISS_CLASS));
  }
  function isPageFieldVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }
  function fieldLabelBlob(el) {
    const parts = [];
    const push = (v) => { const s = String(v || '').replace(/\s+/g, ' ').trim(); if (s && s.length <= 60) parts.push(s); };
    push(el.getAttribute('aria-label'));
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) labelledBy.split(/\s+/).forEach((id) => push(document.getElementById(id)?.textContent));
    if (el.id) { try { push(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent); } catch {} }
    push(el.closest('label')?.textContent);
    push(el.getAttribute('placeholder'));
    push(el.getAttribute('data-placeholder'));
    // 前序兄弟文本：必须含中文或字母且长度≥2，排除范围选择器中间的「-」分隔符（否则循环会提前 break）
    const pushPrevText = (node) => {
      if (!node || isEditable(node) || node.querySelector('input, textarea, select, [contenteditable]')) return;
      const t = node.textContent.replace(/\s+/g, '');
      if (t.length >= 2 && t.length <= 60 && /[\u4e00-\u9fa5a-zA-Z]/.test(t)) push(node.textContent);
    };
    pushPrevText(el.previousElementSibling);
    // el-form / ant-form 这类组件库：label 与输入框是兄弟分支，向上找就近祖先里的 label 文字
    // 直接子 label 任何层级都可信；[class*=label]/div>label 只在 form-item 类容器里采信，防止爬到 body 串到别的字段
    // 最后兜底：祖先里「不含输入框、文字很短」的兄弟元素大概率就是 label（覆盖无 label 标签、无 label class 的站点）
    let host = el.parentElement;
    for (let d = 0; host && d < 4; d += 1, host = host.parentElement) {
      const before = parts.length; // 只有本层循环真的加了内容才停，placeholder 不算
      let labEl = host.querySelector(':scope > label');
      if (!labEl && /(form|field|item|group|control|content)/i.test(host.getAttribute('class') || '')) {
        labEl = host.querySelector(':scope > [class*="label" i], :scope > div > label');
      }
      if (!labEl) {
        // 必须含中文或字母且长度≥2：排除范围选择器中间的「-」分隔符这类纯符号节点
        labEl = [...host.children].find((c) => !c.contains(el)
          && !c.querySelector('input, textarea, select, [contenteditable]')
          && (() => { const t = c.textContent.replace(/\s+/g, ''); return t.length >= 2 && t.length <= 24 && /[\u4e00-\u9fa5a-zA-Z]/.test(t); })());
      }
      if (labEl && !labEl.contains(el)) push(labEl.textContent);
      pushPrevText(host.previousElementSibling);
      if (parts.length > before) break;
    }
    // name/id 是弱信号，放最后兜底
    push(el.getAttribute('name'));
    push(el.id);
    return parts.join(' ');
  }
  // 只读字段一般是展示态要跳过，但自定义下拉/日期组件的输入框也是只读的——这些「组件触发器」要纳入扫描
  function isWidgetTrigger(el) {
    if (el.getAttribute('aria-haspopup')) return true;
    if (el.closest('[class*="select" i], [class*="picker" i], [class*="dropdown" i], [class*="cascader" i]')) return true;
    return /(日期|时间|生日|date|time)/i.test(fieldLabelBlob(el));
  }
  // skipped（可选）：收集被排除的字段及原因，写进诊断报告
  function scanPageFields(skipped) {
    const fields = [];
    document.querySelectorAll('input, textarea, select, [role="combobox"], [contenteditable="true"], [contenteditable=""]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.closest(`#${PANEL_ID}`)) return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'input') {
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (['hidden', 'checkbox', 'radio', 'button', 'submit', 'file', 'password', 'image', 'reset', 'range', 'color'].includes(type)) return;
      }
      const skip = (reason) => { skipped?.push({ reason, blob: fieldLabelBlob(el) || el.getAttribute('placeholder') || el.getAttribute('name') || tag }); };
      if (el.disabled) { skip('禁用'); return; }
      let kind = tag === 'select' ? 'select' : 'text';
      if (tag !== 'select') {
        if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup')) kind = 'widget';
        else if (el.readOnly) {
          if (!isWidgetTrigger(el)) { skip('只读'); return; }
          kind = 'widget';
        }
      }
      if (!isPageFieldVisible(el)) { skip('不可见'); return; }
      // 已有内容的字段不覆盖
      if (tag === 'select') { if (el.value && el.selectedIndex > 0) { skip('已有值'); return; } }
      else if (el.isContentEditable) { if (el.textContent.trim()) { skip('已有值'); return; } }
      else if (String(el.value || '').trim()) { skip('已有值'); return; }
      const blob = fieldLabelBlob(el);
      if (!blob) { skip('无上下文'); return; } // 没有任何上下文线索的字段匹配不了，也不标橙制造噪音
      fields.push({ el, tag, kind, blob });
    });
    return fields;
  }
  function buildAutofillValues(editable) {
    const profile = editable?.profile || {};
    const labelOf = {};
    BASIC_FIELDS.forEach((f) => { labelOf[f.key] = f.label; });
    MODULES.forEach((m) => { labelOf[m.key] = m.label; });
    const values = Object.keys(profile)
      .map((key) => ({ key, label: labelOf[key] || key, value: String(profile[key] || '').trim() }))
      .filter((x) => x.value);
    // 扩展字段：有内容才可填；标题给 AI/规则做语义匹配，没标题用内容摘要代替
    (editable?.customFields || []).forEach((cf, i) => {
      const content = String(cf?.content || '').trim();
      if (!content) return;
      const title = String(cf?.title || '').trim();
      values.push({ key: `custom_${i}`, label: title || truncate(content, 10), value: content });
    });
    return values;
  }
  function matchAutofillKey(blob, values, extraRules = []) {
    const text = String(blob || '').toLowerCase();
    if (!text) return null;
    const available = values instanceof Set ? values : new Set(values.map((v) => v.key));
    let best = null, bestScore = 0;
    // extraRules（扩展字段的标题）排在前面：同分时用户自定义规则优先
    [...extraRules, ...AUTOFILL_RULES].forEach((rule) => {
      if (!available.has(rule.key)) return;
      if (rule.block?.some((w) => text.includes(w))) return;
      rule.words.forEach((word) => {
        if (word.length > bestScore && text.includes(word)) { best = rule.key; bestScore = word.length; }
      });
    });
    return best;
  }
  function fillSelectOption(el, value) {
    const v = String(value || '').trim().toLowerCase();
    if (!v) return false;
    const options = [...el.options].filter((o) => o.text.trim() || o.value.trim());
    const hit = options.find((o) => o.text.trim().toLowerCase() === v || o.value.trim().toLowerCase() === v)
      || options.find((o) => { const t = o.text.trim().toLowerCase(); return t.length >= 2 && (t.includes(v) || v.includes(t)); });
    if (!hit) return false;
    el.value = hit.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function fillPageField(el, value) {
    const v = String(value || '').trim();
    if (!v || v === '至今') return false;
    if (el.tagName.toLowerCase() === 'select') return fillSelectOption(el, v);
    if (el.isContentEditable) {
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, v);
      return true;
    }
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    let out = v;
    if (type === 'date') { const d = normalizeDate(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; out = d; }
    if (type === 'month') { const d = normalizeDate(v); if (!/^\d{4}-\d{2}/.test(d)) return false; out = d.slice(0, 7); }
    setNativeValue(el, out);
    // 日期值校验：控件把日期改写成了不含年份的碎片（如只留个月份数字）→ 清空按失败处理（宁缺勿错）
    if (/^\d{4}/.test(out) && !String(el.value || '').includes(out.slice(0, 4))) {
      setNativeValue(el, '');
      return false;
    }
    return true;
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // 组件填充：日期类——先点开组件，摘掉 readonly 再写入（组件会当作用户打字解析），Enter/blur 提交后恢复 readonly
  async function fillWidgetDate(el, value) {
    const d = normalizeDate(value);
    el.scrollIntoView({ block: 'center' });
    el.click();
    await sleep(150);
    const wasReadOnly = el.readOnly;
    if (wasReadOnly) el.removeAttribute('readonly');
    el.focus();
    setNativeValue(el, d);
    ['keydown', 'keypress', 'keyup'].forEach((t) => el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })));
    el.blur();
    await sleep(100);
    if (wasReadOnly) el.setAttribute('readonly', '');
    // 判定成功：值里必须有 4 位年份（防止组件拒绝后残留 '1' 这类碎片被误判成功）
    return /(19|20)\d{2}/.test(String(el.value || ''));
  }
  // 组件填充：选项类——点开 → 在弹层里按文本匹配选项 → 点击；失败 Esc 关闭
  async function fillWidgetByOption(el, value) {
    const v = String(value || '').trim().toLowerCase();
    el.scrollIntoView({ block: 'center' });
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.click();
    await sleep(300);
    const containers = [...document.querySelectorAll('[role="listbox"], [role="menu"], [class*="dropdown" i], [class*="select" i], [class*="picker" i], [class*="popper" i], [class*="cascader" i]')]
      .filter((c) => c instanceof HTMLElement && !c.closest(`#${PANEL_ID}`) && isPageFieldVisible(c));
    let options = [];
    containers.forEach((c) => c.querySelectorAll('[role="option"], li, [class*="option" i], [class*="item" i]').forEach((o) => options.push(o)));
    if (!options.length) options = [...document.querySelectorAll('[role="option"]')];
    const seen = new Set();
    const norm = (o) => o.textContent.replace(/\s+/g, ' ').trim();
    const candidates = options.filter((o) => {
      if (!(o instanceof HTMLElement) || seen.has(o) || o.closest(`#${PANEL_ID}`)) return false;
      seen.add(o);
      if (!isPageFieldVisible(o)) return false;
      const t = norm(o);
      return t && t.length <= 24 && o.children.length <= 3;
    });
    const hit = candidates.find((o) => norm(o).toLowerCase() === v)
      || candidates.find((o) => { const t = norm(o).toLowerCase(); return t.length >= 2 && (t.includes(v) || v.includes(t)); });
    if (hit) {
      hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      hit.click();
      await sleep(120);
      return true;
    }
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    document.body.click();
    return false;
  }
  async function fillWidgetField(el, value) {
    const v = String(value || '').trim();
    if (!v || v === '至今') return false;
    const isDate = /^\d{4}-\d{2}/.test(normalizeDate(v));
    if (isDate && (el.tagName.toLowerCase() === 'input' || el.isContentEditable)) return fillWidgetDate(el, v);
    // 起止时间这类范围选择：单个输入框吃不下两个日期，直接放弃标橙
    if (isDate) return false;
    return fillWidgetByOption(el, v);
  }
  async function fillFieldAuto(field, value) {
    if (field.kind === 'widget') return fillWidgetField(field.el, value);
    return fillPageField(field.el, value);
  }
  // ===== 裸日期控件（年/月/日）归类：Moka 这类站点的时间选择是独立的年/月下拉，label 只有光秃秃的「年」「月」=====
  // 按「包含 ≥2 个裸日期控件的最小祖先」分组：组内 ≥4 个（偶数）→ 前一半=开始时间、后一半=结束时间；
  // 2-3 个 → 看容器文案：含 开始/入学 类词=开始时间，含 结束/毕业 类词=结束时间；两类词都有或都没有则不乱填
  const BARE_DATE_RE = /^(年|月|日)$/;
  const DATE_START_WORDS = /(开始|起始|入学|入职)/;
  const DATE_END_WORDS = /(结束|截止|毕业|离职)/;
  function classifyBareDateParts(fields) {
    const bare = fields.filter((f) => BARE_DATE_RE.test(f.blob.replace(/\s+/g, '')));
    const result = new Map();
    if (!bare.length) return result;
    const groups = new Map();
    bare.forEach((f) => {
      let node = f.el.parentElement;
      for (let d = 0; node && d < 5; d += 1, node = node.parentElement) {
        if (bare.filter((b) => node.contains(b.el)).length >= 2) {
          if (!groups.has(node)) groups.set(node, []);
          groups.get(node).push(f);
          return;
        }
      }
    });
    groups.forEach((members, node) => {
      members.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    });
    // 开始组/结束组各有一层包装时（如 [年 月] - [年 月]），最小容器只能圈到 2 个成员且没有关键词。
    // 相邻小组向上看公共祖先：恰好只含这两组裸日期控件且文本很短（≤30 字，防止跨经历块误并）→ 并为一组
    const groupList = [...groups.entries()];
    let didMerge = true;
    while (didMerge) {
      didMerge = false;
      for (let i = 0; i < groupList.length && !didMerge; i += 1) {
        for (let j = i + 1; j < groupList.length && !didMerge; j += 1) {
          const [nodeA, memA] = groupList[i];
          const [nodeB, memB] = groupList[j];
          let lca = nodeA.parentElement;
          for (let d = 0; lca && d < 6 && !lca.contains(nodeB); d += 1, lca = lca.parentElement) {}
          if (!lca) continue;
          const union = [...memA, ...memB];
          if (union.length > 6) continue;
          if (bare.filter((b) => lca.contains(b.el)).length !== union.length) continue;
          if (String(lca.textContent || '').replace(/\s+/g, '').length > 30) continue;
          groupList.splice(j, 1);
          groupList[i] = [lca, union];
          didMerge = true;
        }
      }
    }
    new Map(groupList).forEach((members, node) => {
      members.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
      const ctx = String(node.textContent || '').replace(/\s+/g, '');
      const hasStart = DATE_START_WORDS.test(ctx);
      const hasEnd = DATE_END_WORDS.test(ctx);
      let subs = null;
      if (members.length >= 4 && members.length % 2 === 0) {
        const half = members.length / 2;
        subs = members.map((_, i) => (i < half ? 'expStart' : 'expEnd'));
      } else if (hasStart && !hasEnd) subs = members.map(() => 'expStart');
      else if (hasEnd && !hasStart) subs = members.map(() => 'expEnd');
      if (!subs) return;
      members.forEach((f, i) => {
        const label = f.blob.replace(/\s+/g, '');
        result.set(f.el, { sub: subs[i], part: label === '年' ? 'year' : label === '月' ? 'month' : 'day' });
      });
    });
    return result;
  }
  // 完整日期按控件角色截取：年控件拿 '2023'；月控件拿 '6'（不补零，兼容 '6月'/'06' 两种选项文案）
  function datePartValue(value, part) {
    const d = normalizeDate(value);
    if (!/^\d{4}-\d{2}/.test(d)) return '';
    if (part === 'year') return d.slice(0, 4);
    if (part === 'month') return String(Number(d.slice(5, 7)));
    if (part === 'day') return d.length >= 10 ? String(Number(d.slice(8, 10))) : '';
    return d;
  }
  // ===== 经历块：聚类 → 判型 → 按条目填充 → 自动点「添加」扩块 =====
  const EXP_RULE_KEYS = ['expCompany', 'expTitle', 'expRole', 'expStart', 'expEnd', 'expDesc'];
  // 已填入的经历块轨迹（文档顺序）：二次扫描补出的单独日期框（如开始日期填完才出现的结束框）按就近原则归到前面最近的经历块
  let anchoredTrail = [];
  const EXP_SUB_LABELS = { expCompany: '公司', expTitle: '项目名', expRole: '职位', expStart: '开始时间', expEnd: '结束时间', expDesc: '描述' };
  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dbgLine = (icon, blob, note) => `${icon} 「${escHtml(truncate(blob, 24))}」${note}`;
  const EXP_TYPE_KEYWORDS = { internship: ['实习'], work: ['工作', '全职'], project: ['项目'] };
  function buildExpEntries(editable) {
    const entries = [];
    ['internship', 'work', 'project'].forEach((type) => {
      (editable?.experiences?.[type] || []).forEach((item, index) => {
        if (!Object.values(item || {}).some((v) => String(v || '').trim())) return;
        // 数据护栏：开始时间晚于结束时间（解析颠倒）→ 自动交换，避免填出「开始>结束」
        const it = { ...item };
        const s = normalizeDate(it.start);
        const e = normalizeDate(it.end);
        if (s && e && e !== '至今' && s > e) { it.start = e; it.end = s; }
        entries.push({ type, index, data: it });
      });
    });
    return entries;
  }
  function expEntryValue(entry, sub) {
    const d = entry?.data || {};
    if (sub === 'expCompany') return String(d.company || d.title || '').trim();
    if (sub === 'expTitle') return String(d.title || d.company || '').trim();
    if (sub === 'expRole') return String(d.role || '').trim();
    if (sub === 'expStart') return String(d.start || '').trim();
    if (sub === 'expEnd') return String(d.end || '').trim();
    if (sub === 'expDesc') return String(d.description || '').trim();
    return '';
  }
  // 用块的最近公共祖先（再向上 3 层）的文字判断经历类型（实习/工作/项目），容器太大放弃
  function detectExpBlockType(block) {
    let node = block[0].field.el.parentElement;
    while (node && !block.every(({ field }) => node.contains(field.el))) node = node.parentElement;
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      const text = node.textContent.replace(/\s+/g, '');
      if (text.length > 1200) continue;
      for (const [type, words] of Object.entries(EXP_TYPE_KEYWORDS)) {
        if (words.some((w) => text.includes(w))) return type;
      }
    }
    return null;
  }
  // 按文档顺序聚块：遇到 公司/项目名（锚点）或同名字段重复出现就开新块；没有锚点的块不吸收后续字段
  // 起止时间是两个输入框（开始/结束）且共用一个标签时，两个框都会匹配 expStart——把同块里第二个转成 expEnd
  function clusterExpBlocks(expFieldEntries) {
    const hasAnchor = (block) => block.some((x) => x.sub === 'expCompany' || x.sub === 'expTitle');
    const blocks = [];
    expFieldEntries.forEach((raw) => {
      const item = { ...raw };
      const last = blocks[blocks.length - 1];
      const isAnchor = item.sub === 'expCompany' || item.sub === 'expTitle';
      if (!item.part && last && item.sub === 'expStart' && hasAnchor(last)
        && last.some((x) => x.sub === 'expStart') && !last.some((x) => x.sub === 'expEnd')) {
        item.sub = 'expEnd';
      }
      // 年/月控件同 sub 不算重复（sub 相同但 part 不同）；一个块里常有多个描述类文本域（职责/项目描述/项目中职责），都填同一段描述，不拆块
      const dup = last && (item.part
        ? last.some((x) => x.sub === item.sub && x.part === item.part)
        : item.sub === 'expDesc'
          ? false
          : last.some((x) => x.sub === item.sub));
      // 纯裸日期块：起止时间在块顶部的版式（Moka），年/月组先于公司/项目名出现
      const lastPureDates = !!(last && !hasAnchor(last) && last.every((x) => x.part));
      // 前一个锚定块还没有任何时间字段 → 尾部跟随的日期属于它（起止时间在块底部的版式）
      const lastNeedsDates = !!(last && hasAnchor(last) && !last.some((x) => x.sub === 'expStart' || x.sub === 'expEnd'));
      let startsNew;
      if (!last) startsNew = true;
      else if (item.part) startsNew = !(lastPureDates || lastNeedsDates);
      else if (isAnchor) startsNew = !lastPureDates; // 锚点前面若是同组裸日期 → 并入组成完整块
      else startsNew = dup || !hasAnchor(last);
      if (startsNew) blocks.push([item]);
      else last.push(item);
    });
    return blocks;
  }
  function takeExpEntry(expEntries, consumed, preferredType) {
    if (preferredType) {
      const typed = expEntries.find((e) => e.type === preferredType && !consumed.has(e));
      if (typed) return typed;
    }
    return expEntries.find((e) => !consumed.has(e)) || null;
  }
  async function fillExpBlocks(expFieldEntries, expEntries, consumed, missed, basicValueOf, dbg = []) {
    let count = 0;
    const blocks = clusterExpBlocks(expFieldEntries);
    let blockIndex = 0;
    let lastLoneEffSub = null; // 上一个无锚日期字段的有效 sub：连续两个 expStart 时第二个转 expEnd（教育起止对）
    for (const block of blocks) {
      const anchored = block.some((x) => x.sub === 'expCompany' || x.sub === 'expTitle');
      if (!anchored) {
        // 没有公司/项目名的日期块：前面有已填经历块 → 就近归到该块（二次扫描补出的结束框）；
        // 否则多半是教育经历 → 回落到基础字段的入学/毕业时间（blob 必须像日期才回落，防长文本误判）
        for (const x of block) {
          const { field, sub } = x;
          let v = '';
          let note = '';
          // 找文档顺序上排在这个字段前面、最近的一个已填经历块
          const trail = anchoredTrail.filter((t) => t.el.compareDocumentPosition(field.el) & Node.DOCUMENT_POSITION_FOLLOWING).pop() || null;
          let effSub = sub;
          // 该经历块已经填过开始时间 → 这个后出现的日期框是结束时间（part 字段 sub 是确定的，不参与推断）
          if (!x.part && trail && sub === 'expStart' && trail.subs?.includes('expStart')) effSub = 'expEnd';
          else if (!x.part && !trail && sub === 'expStart' && lastLoneEffSub === 'expStart') effSub = 'expEnd';
          if ((effSub === 'expStart' || effSub === 'expEnd') && trail) {
            v = expEntryValue(trail.entry, effSub);
            const entryName = expEntryValue(trail.entry, 'expCompany') || '就近经历';
            note = ` → ${EXP_SUB_LABELS[effSub]}（${escHtml(truncate(entryName, 16))}，就近补全）`;
          }
          if (!v) {
            const basicKey = effSub === 'expStart' ? 'educationStart' : effSub === 'expEnd' ? 'educationEnd' : null;
            const label = basicKey === 'educationStart' ? '入学时间' : basicKey === 'educationEnd' ? '毕业时间' : null;
            const dateish = !!x.part || /(时间|日期|起止|入学|毕业|date|time)/i.test(field.blob);
            v = basicKey && dateish ? basicValueOf(basicKey) : '';
            if (v) note = ` → ${label}（教育回落）`;
          }
          if (!x.part && (effSub === 'expStart' || effSub === 'expEnd')) lastLoneEffSub = effSub;
          if (v && x.part) v = datePartValue(v, x.part);
          if (v && (await fillFieldAuto(field, v))) {
            field.el.classList.add(AUTOFILL_FILL_CLASS); count += 1;
            dbg.push(dbgLine('✓', field.blob, note));
          } else {
            missed.push(field);
            const dateish = !!x.part || /(时间|日期|起止|入学|毕业|date|time)/i.test(field.blob);
            dbg.push(dbgLine('✗', field.blob, v ? `${note}（填入失败）` : (dateish ? '（判为教育时间但简历为空，未填）' : '（经历时间字段但上下文不足，未填）')));
          }
        }
        continue;
      }
      lastLoneEffSub = null;
      blockIndex += 1;
      const type = detectExpBlockType(block);
      const entry = takeExpEntry(expEntries, consumed, type);
      if (!entry) {
        block.forEach((x) => missed.push(x.field));
        dbg.push(`✗ 经历块${blockIndex}：简历里没有更多经历条目可填`);
        continue;
      }
      consumed.add(entry);
      const entryName = expEntryValue(entry, 'expCompany') || `${entry.type}#${entry.index + 1}`;
      for (const x of block) {
        const { field, sub } = x;
        let v = expEntryValue(entry, sub);
        if (v && x.part) v = datePartValue(v, x.part);
        if (v && (await fillFieldAuto(field, v))) {
          field.el.classList.add(AUTOFILL_FILL_CLASS); count += 1;
          dbg.push(dbgLine('✓', field.blob, ` → ${EXP_SUB_LABELS[sub]}（${escHtml(truncate(entryName, 16))}）`));
        } else {
          missed.push(field);
          dbg.push(dbgLine('✗', field.blob, v ? ` → ${EXP_SUB_LABELS[sub]}（填入失败）` : ` → ${EXP_SUB_LABELS[sub]}（简历为空）`));
        }
      }
      anchoredTrail.push({ entry, el: block[block.length - 1].field.el, subs: block.map((x) => x.sub) });
    }
    return count;
  }
  // 找页面上的「添加经历」按钮：要求上下文带 实习/工作/项目/经历 字样，避免误点「添加附件」之类
  function findAddButton(typeWords) {
    const cands = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], [class*="add" i], [class*="plus" i]')]
      .filter((el) => el instanceof HTMLElement && !el.closest(`#${PANEL_ID}`) && isPageFieldVisible(el))
      .map((el) => ({ el, text: String(el.textContent || el.value || '').replace(/\s+/g, '') }))
      .filter((x) => x.text && x.text.length <= 14 && /(添加|新增|增加|＋|\+)/.test(x.text));
    if (!cands.length) return null;
    const ctxOf = (el) => {
      let ctx = '';
      let node = el;
      for (let d = 0; node && d < 3; d += 1, node = node.parentElement) ctx += node.textContent.replace(/\s+/g, '');
      return ctx.slice(0, 400);
    };
    const typed = cands.find((x) => typeWords.some((w) => ctxOf(x.el).includes(w)));
    if (typed) return typed.el;
    const generic = cands.find((x) => /(经历|经验|教育)/.test(ctxOf(x.el)));
    return generic ? generic.el : null;
  }
  // 简历里还有经历没填完：自动点「添加」扩出新块，再填下一段
  async function growExpBlocks(expEntries, consumed, missed, available, dbg = []) {
    let count = 0;
    for (let guard = 0; guard < 6; guard += 1) {
      const remaining = expEntries.filter((e) => !consumed.has(e));
      if (!remaining.length) break;
      const btn = findAddButton(EXP_TYPE_KEYWORDS[remaining[0].type] || []);
      if (!btn) { dbg.push(`✋ 还有 ${remaining.length} 段经历未填：页面上没找到「添加经历」按钮`); break; }
      const before = new Set(scanPageFields().map((f) => f.el));
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      await sleep(500);
      const fresh = scanPageFields().filter((f) => !before.has(f.el));
      const freshExp = [];
      const freshBareParts = classifyBareDateParts(fresh);
      fresh.forEach((field) => {
        const bareHit = freshBareParts.get(field.el);
        if (bareHit) { freshExp.push({ field, sub: bareHit.sub, part: bareHit.part }); return; }
        const key = matchAutofillKey(field.blob, available);
        if (key && EXP_RULE_KEYS.includes(key)) freshExp.push({ field, sub: key });
      });
      if (!freshExp.length) { dbg.push('✋ 点了「添加」但没识别出新块里的字段，停止扩块'); break; }
      const entry = remaining[0];
      consumed.add(entry);
      const entryName = expEntryValue(entry, 'expCompany') || `${entry.type}#${entry.index + 1}`;
      dbg.push(`➕ 点了「添加」，填入经历：${escHtml(truncate(entryName, 16))}`);
      for (const { field, sub, part } of freshExp) {
        let v = expEntryValue(entry, sub);
        if (v && part) v = datePartValue(v, part);
        if (v && (await fillFieldAuto(field, v))) { field.el.classList.add(AUTOFILL_FILL_CLASS); count += 1; }
        else missed.push(field);
      }
      anchoredTrail.push({ entry, el: freshExp[freshExp.length - 1].field.el, subs: freshExp.map((x) => x.sub) });
    }
    return count;
  }
  // ===== AI 识别（主力）：程序把页面聚成整体块 → AI 按块语义识别 → 程序保守填写 =====
  const AI_RECOGNIZE_PROMPT = `你是招聘网页表单的识别助手。用户会给你「页面块」和「简历数据」两组 JSON。
页面块（blocks）：程序按 DOM 结构把相邻字段聚成的整体，每块含 id、hint（块内文本摘要）、fields（字段列表：id/label/input/options）。
简历数据（resume）：basic 是基础字段（只列有内容的；key 以 custom_ 开头的是用户自定义字段，label 是用户自拟的标题，按标题语义匹配网页字段）；experiences 是经历条目（实习/工作/项目，index 从 0 开始）。
任务：判断每个字段应该填简历里的什么内容，只输出 JSON：
{"blocks": {"块id": {"exp": 经历index或null, "fields": {"字段id": {"key": "basic的key"} 或 {"sub": "company|title|role|start|end|desc", "part": "year|month|day"}}}}}
规则：
1. 宁缺毋滥：没有把握的字段不要返回，没有把握的块整个不要返回。填错比留空更严重。
2. 经历块（实习/工作/项目）：exp 填该块对应简历第几段经历的 index，块内字段用 sub。只有当年/月/日是各自独立的控件（label 就是「年」「月」「日」本身）时才用 part 标 year/month/day；一个完整的日期选择框（带日历图标、输入完整日期）绝不用 part。
3. 非经历块（基础信息/教育/技能等）：exp 为 null，字段用 key。教育时间用 educationStart/educationEnd，拆分控件同样带 part。
4. 经历类型必须严格匹配：块标题是「实习」→ 只能分配 type=实习 的条目；「工作」→ type=工作；「项目」→ type=项目。没有同类型条目可分配时，整块不要返回（留空比填错好得多）。
5. 每段经历只能分配给一个块；同一块的字段必须指向同一段经历；多块时不要按顺序硬凑，按块标题和内容对应。
6. experiences 里 fields 列出该条目非空的字段：fields 越少越可能是解析碎片，不要把字段丰富的整块分配给它；字段丰富的块优先分给信息完整的条目。
7. blocks 之外不要输出任何内容。`;
  const AI_SUB_TO_EXPKEY = { company: 'expCompany', title: 'expTitle', role: 'expRole', start: 'expStart', end: 'expEnd', desc: 'expDesc' };
  const AI_PARTS = new Set(['year', 'month', 'day']);
  // 页面块结构标记（纯 DOM，零语义）：每个字段向上找「字段数 2~12 且压缩文本 ≤400 字」的最高祖先，同容器为一块；散点字段各自成块
  function groupPageBlocks(targetFields) {
    const containers = new Map();
    targetFields.forEach((f) => {
      let found = null;
      let node = f.el.parentElement;
      for (let d = 0; node && d < 8; d += 1, node = node.parentElement) {
        const members = targetFields.filter((x) => node.contains(x.el));
        if (members.length > 12) break;
        if (members.length >= 2 && String(node.textContent || '').replace(/\s+/g, '').length <= 400) found = node;
      }
      if (!containers.has(found)) containers.set(found, []);
      containers.get(found).push(f);
    });
    const aiBlocks = [];
    const byId = new Map();
    let seq = 0;
    containers.forEach((members, node) => {
      const groupsToMake = node === null ? members.map((m) => [m]) : [members];
      groupsToMake.forEach((groupFields) => {
        seq += 1;
        const id = `b${seq}`;
        const hintSource = node === null ? groupFields[0].blob : String(node.textContent || '').replace(/\s+/g, ' ').trim();
        const blockFields = new Map();
        const aiFields = groupFields.map((f, i) => {
          const fid = `${id}f${i + 1}`;
          blockFields.set(fid, f);
          const spec = { id: fid, label: truncate(f.blob, 60), input: f.tag === 'select' ? 'select' : f.kind === 'widget' ? 'widget' : (f.el.getAttribute('type') === 'date' ? 'date' : f.tag) };
          if (f.tag === 'select') {
            const opts = [...f.el.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 8);
            if (opts.length) spec.options = opts;
          }
          return spec;
        });
        aiBlocks.push({ id, hint: truncate(hintSource, 150), fields: aiFields });
        byId.set(id, { fields: blockFields });
      });
    });
    return { aiBlocks, byId };
  }
  async function aiRecognizeBlocks(aiBlocks, values, expEntries, { apiKey, model }) {
    const payload = JSON.stringify({
      blocks: aiBlocks,
      resume: {
        basic: values.map((v) => ({ key: v.key, label: v.label })),
        experiences: expEntries.map((e, i) => ({
          index: i,
          type: { internship: '实习', work: '工作', project: '项目' }[e.type] || e.type,
          company: truncate(expEntryValue(e, 'expCompany'), 30),
          title: truncate(expEntryValue(e, 'expTitle'), 30),
          role: truncate(expEntryValue(e, 'expRole'), 30),
          period: `${expEntryValue(e, 'expStart') || '?'} ~ ${expEntryValue(e, 'expEnd') || '至今'}`,
          // 非空子字段清单：帮 AI 避开解析产生的「空心条目」
          fields: ['expCompany', 'expTitle', 'expRole', 'expStart', 'expEnd', 'expDesc']
            .filter((k) => expEntryValue(e, k))
            .map((k) => EXP_SUB_LABELS[k])
        }))
      }
    });
    const response = await chrome.runtime.sendMessage({ type: 'DEEPSEEK_MATCH', apiKey, model, systemPrompt: AI_RECOGNIZE_PROMPT, userText: payload });
    if (!response?.ok) throw new Error(response?.error || 'AI 请求失败');
    const content = String(response.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(content || '{}');
    return parsed?.blocks && typeof parsed.blocks === 'object' ? parsed.blocks : {};
  }
  // 保守填写：AI 返回逐条校验，非法/存疑一律丢弃；同一段经历只填一个块（allowConsumed=二次补扫时允许给已填块补后出现的字段）
  async function applyAiBlocks(aiResult, { byId, values, expEntries, consumed, missed, dbg, allowConsumed = false }) {
    let count = 0;
    const basicKeys = new Set(values.map((v) => v.key));
    const claimed = new Set();
    for (const [blockId, bres] of Object.entries(aiResult || {})) {
      const block = byId.get(blockId);
      if (!block || !bres || typeof bres !== 'object') continue;
      const markBlockMissed = () => block.fields.forEach((f) => { if (!missed.includes(f)) missed.push(f); });
      let entry = null;
      let entryName = '';
      if (bres.exp !== null && bres.exp !== undefined) {
        const idx = Number(bres.exp);
        entry = Number.isInteger(idx) ? expEntries[idx] || null : null;
        if (!entry) {
          dbg.push(`⚠ AI 给块 ${blockId} 分配的经历序号非法，整块标橙忽略`);
          markBlockMissed();
          continue;
        }
        entryName = expEntryValue(entry, 'expCompany') || expEntryValue(entry, 'expTitle') || `${entry.type}#${entry.index + 1}`;
        dbg.push(`🧠 块 ${blockId} → ${({ internship: '实习', work: '工作', project: '项目' })[entry.type] || entry.type}「${escHtml(truncate(entryName, 16))}」`);
        if (consumed.has(entry) && !allowConsumed) {
          dbg.push(`⚠ 经历「${escHtml(truncate(entryName, 16))}」被重复分配，块 ${blockId} 标橙跳过`);
          markBlockMissed();
          continue;
        }
      }
      let blockFilled = 0;
      for (const [fid, m] of Object.entries(bres.fields || {})) {
        const field = block.fields.get(fid);
        if (!field || claimed.has(fid) || !m || typeof m !== 'object') continue;
        claimed.add(fid);
        let v = '';
        let label = '';
        if (typeof m.key === 'string') {
          const item = basicKeys.has(m.key) ? values.find((x) => x.key === m.key) : null;
          if (!item) { missed.push(field); dbg.push(dbgLine('✗', field.blob, '（AI 指定了无效字段，留空）')); continue; }
          v = item.value; label = item.label;
        } else if (typeof m.sub === 'string' && AI_SUB_TO_EXPKEY[m.sub]) {
          if (!entry) { missed.push(field); dbg.push(dbgLine('✗', field.blob, '（AI 未给该块分配经历，留空）')); continue; }
          v = expEntryValue(entry, AI_SUB_TO_EXPKEY[m.sub]);
          label = EXP_SUB_LABELS[AI_SUB_TO_EXPKEY[m.sub]];
        } else {
          missed.push(field);
          continue;
        }
        if (v && AI_PARTS.has(m.part)) {
          // AI 误判护栏：part 只服务于「年/月/日独立控件」（label 就是年月日本身的 select/组件）。
          // 完整日期控件（type=date、标签含时间/日期/起止、或在 date/picker 类容器里）一律忽略 part 填整值
          const barePart = /^(年|月|日)$/.test(field.blob.replace(/\s+/g, ''));
          const fullDateCtl = !barePart && field.tag !== 'select'
            && (field.el.getAttribute('type') === 'date'
              || /(时间|日期|起止|生日|date)/i.test(field.blob)
              || !!field.el.closest('[class*="picker" i], [class*="date" i]'));
          v = fullDateCtl ? v : datePartValue(v, m.part);
        }
        const note = ` → ${label}${entryName ? `（${escHtml(truncate(entryName, 16))}）` : ''}（AI）`;
        if (v && (await fillFieldAuto(field, v))) {
          field.el.classList.add(AUTOFILL_FILL_CLASS); count += 1; blockFilled += 1;
          dbg.push(dbgLine('✓', field.blob, note));
        } else {
          missed.push(field);
          dbg.push(dbgLine('✗', field.blob, v ? `${note}（填入失败）` : `${note}（简历为空）`));
        }
      }
      if (entry && blockFilled) consumed.add(entry);
    }
    return count;
  }
  // AI 路径：按块整体识别 → 保守填写；AI 未覆盖的字段一律标橙留空（保守红线）
  async function aiFillFields(targetFields, entriesForAi, { values, consumed, missed, dbg, aiCred, allowConsumed = false }) {
    const { aiBlocks, byId } = groupPageBlocks(targetFields);
    const aiResult = await aiRecognizeBlocks(aiBlocks, values, entriesForAi, aiCred);
    const count = await applyAiBlocks(aiResult, { byId, values, expEntries: entriesForAi, consumed, missed, dbg, allowConsumed });
    targetFields.forEach((f) => {
      if (!f.el.classList.contains(AUTOFILL_FILL_CLASS) && !missed.includes(f)) {
        missed.push(f);
        dbg.push(dbgLine('○', f.blob, '（AI 未识别，留空）'));
      }
    });
    return count;
  }
  // AI 路径的扩块：点「添加」逻辑与规则版一致，新块交给 AI 识别（只分配剩余条目）
  async function growExpBlocksAi(expEntries, consumed, missed, { values, dbg, aiCred }) {
    let count = 0;
    for (let guard = 0; guard < 6; guard += 1) {
      const remaining = expEntries.filter((e) => !consumed.has(e));
      if (!remaining.length) break;
      const btn = findAddButton(EXP_TYPE_KEYWORDS[remaining[0].type] || []);
      if (!btn) { dbg.push(`✋ 还有 ${remaining.length} 段经历未填：页面上没找到「添加经历」按钮`); break; }
      const before = new Set(scanPageFields().map((f) => f.el));
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      await sleep(500);
      const fresh = scanPageFields().filter((f) => !before.has(f.el));
      if (!fresh.length) { dbg.push('✋ 点了「添加」但没出现新字段，停止扩块'); break; }
      const beforeCount = count;
      try {
        count += await aiFillFields(fresh, remaining, { values, consumed, missed, dbg, aiCred });
      } catch (error) {
        dbg.push(`⚠ 扩块 AI 识别失败：${escHtml(String(error?.message || error))}`);
        fresh.forEach((f) => { if (!missed.includes(f)) missed.push(f); });
        break;
      }
      if (count === beforeCount) { dbg.push('✋ 新块 AI 未能识别，停止扩块'); break; }
      dbg.push('➕ 点了「添加」，AI 已识别并填入新块');
    }
    return count;
  }
  // ===== 规则路径（冻结兜底）：关键词识别 + 块聚类，无 AI 或 AI 失败时整体接管 =====
  async function ruleFillFields(targetFields, { values, available, basicValueOf, expEntries, consumed, missed, dbg, customRules = [] }) {
    let count = 0;
    const expFieldEntries = [];
    const bareDateParts = classifyBareDateParts(targetFields);
    const bareUsable = (hit) => available.has(hit.sub)
      || available.has(hit.sub === 'expStart' ? 'educationStart' : 'educationEnd');
    for (const field of targetFields) {
      const bareHit = bareDateParts.get(field.el);
      if (bareHit && bareUsable(bareHit)) { expFieldEntries.push({ field, sub: bareHit.sub, part: bareHit.part }); continue; }
      const key = matchAutofillKey(field.blob, available, customRules);
      if (!key) { missed.push(field); dbg.push(dbgLine('○', field.blob, '（未识别）')); continue; }
      if (EXP_RULE_KEYS.includes(key)) { expFieldEntries.push({ field, sub: key }); continue; }
      const item = values.find((v) => v.key === key);
      if (item && (await fillFieldAuto(field, item.value))) {
        field.el.classList.add(AUTOFILL_FILL_CLASS); count += 1;
        dbg.push(dbgLine('✓', field.blob, ` → ${item.label}${field.kind === 'widget' ? '（组件）' : ''}`));
      } else {
        missed.push(field);
        dbg.push(dbgLine('✗', field.blob, ` → ${item?.label || key}（填入失败${field.kind === 'widget' ? '，组件拒绝' : ''}）`));
      }
    }
    count += await fillExpBlocks(expFieldEntries, expEntries, consumed, missed, basicValueOf, dbg);
    return count;
  }
  async function runAutofill() {
    if (!autofillEnabled) { toast('请先在面板头部开启「自动填充」开关', true); return; }
    clearAutofillHighlights();
    anchoredTrail = [];
    const skipped = [];
    const fields = scanPageFields(skipped);
    if (!fields.length) { toast('当前页面没有识别到待填写的表单项'); playFeedbackSound('fail'); return; }
    const { editable } = await getState();
    const values = buildAutofillValues(editable);
    if (!values.length) { toast('还没有简历数据，请先导入简历', true); playFeedbackSound('fail'); return; }
    const expEntries = buildExpEntries(editable);
    const available = new Set(values.map((v) => v.key));
    if (expEntries.length) EXP_RULE_KEYS.forEach((k) => available.add(k));
    const basicValueOf = (key) => values.find((v) => v.key === key)?.value || '';
    // 扩展字段 → 动态规则：标题作为匹配词（有内容才会进 values/available，没标题不参与规则匹配）
    const customRules = (editable.customFields || [])
      .map((cf, i) => ({ key: `custom_${i}`, words: [String(cf?.title || '').trim().toLowerCase()] }))
      .filter((r) => r.words[0]);

    const dbg = [`🔎 扫描到 ${fields.length} 个待填字段（简历经历条目 ${expEntries.length} 条）`];
    let filledCount = 0;
    const missed = [];
    const consumed = new Set();

    const aiData = await chrome.storage.local.get([AI_KEY, AI_ENABLED_KEY, AI_MODEL_KEY]);
    const aiCred = aiData[AI_KEY] && aiData[AI_ENABLED_KEY]
      ? { apiKey: aiData[AI_KEY], model: aiData[AI_MODEL_KEY] || AI_MODEL_DEFAULT }
      : null;

    // 主扫描：AI 路径（识别 100% 归 AI，程序保守填写）；无 AI 或 AI 失败 → 规则管线整体接管
    // 进度提示全程常驻：从点击到全部阶段结束才消失，每个阶段更新文字
    const progress = toastProgress('⏳ 准备填写…', { global: true });
    if (aiCred) {
      progress.update(`🧠 AI 正在识别 ${fields.length} 个字段…`);
      try {
        filledCount += await aiFillFields(fields, expEntries, { values, consumed, missed, dbg, aiCred });
        dbg.push('🧠 本轮由 AI 识别：未识别的字段已标橙留空（保守不填）');
      } catch (error) {
        progress.update(`⚠ AI 识别失败，已回落规则模式，继续填写…`);
        dbg.push(`⚠ AI 识别失败，回落规则模式：${escHtml(String(error?.message || error))}`);
        filledCount += await ruleFillFields(fields, { values, available, basicValueOf, expEntries, consumed, missed, dbg, customRules });
      }
    } else {
      progress.update(`⏳ 正在按规则识别填写 ${fields.length} 个字段…`);
      filledCount += await ruleFillFields(fields, { values, available, basicValueOf, expEntries, consumed, missed, dbg, customRules });
    }

    // 页面没预留足够的空白经历块：尝试自动点「添加」再补填（AI 优先，规则兜底）
    if (expEntries.some((e) => !consumed.has(e))) {
      progress.update('➕ 还有经历未填，正在补块填写…');
      filledCount += aiCred
        ? await growExpBlocksAi(expEntries, consumed, missed, { values, dbg, aiCred })
        : await growExpBlocks(expEntries, consumed, missed, available, dbg);
    }

    // 二次扫描：有些字段（如范围日期的结束框）在填入开始值后才出现
    progress.update('🔄 正在二次扫描检查遗漏…');
    await sleep(400);
    const seenEls = new Set(fields.map((f) => f.el));
    const fresh = scanPageFields().filter((f) => !seenEls.has(f.el));
    if (fresh.length) {
      dbg.push(`🔄 二次扫描发现 ${fresh.length} 个新字段`);
      if (aiCred) {
        try {
          // allowConsumed：允许给已填的经历块补填后出现的字段（如结束时间框）
          filledCount += await aiFillFields(fresh, expEntries, { values, consumed, missed, dbg, aiCred, allowConsumed: true });
        } catch (error) {
          dbg.push(`⚠ 二次扫描 AI 识别失败，新字段标橙留空：${escHtml(String(error?.message || error))}`);
          fresh.forEach((f) => { if (!missed.includes(f)) missed.push(f); });
        }
      } else {
        filledCount += await ruleFillFields(fresh, { values, available, basicValueOf, expEntries, consumed, missed, dbg, customRules });
      }
    }
    if (skipped.length) {
      dbg.push(`—— 跳过的 ${skipped.length} 个字段（未参与填写） ——`);
      skipped.slice(0, 15).forEach((s) => dbg.push(dbgLine('◌', s.blob, `（跳过：${s.reason}）`)));
    }
    missed.forEach((field) => field.el.classList.add(AUTOFILL_MISS_CLASS));
    setImportDebug(dbg);
    // 三种结果三种提示音：全部填入 / 部分未填 / 一项都没填入
    playFeedbackSound(filledCount === 0 ? 'fail' : missed.length ? 'partial' : 'complete');
    progress.done(missed.length
      ? `✅ 填写结束：填入 ${filledCount} 项，${missed.length} 项标黄待手动`
      : `✅ 全部 ${filledCount} 项已填入，请检查后提交`);
  }
  async function fillToActive(value) { const copied = await copyValue(value); const target = document.activeElement && isEditable(document.activeElement) ? document.activeElement : lastActiveEditable; if (target && isEditable(target)) { if (target.isContentEditable) { target.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, value); } else { target.focus(); setNativeValue(target, value); } toast(copied ? '已复制并写入输入框' : '已写入输入框'); return; } toast(copied ? '未找到输入框，内容已复制' : '请先点击目标输入框后再点字段', !copied); }
  const AI_SYSTEM_PROMPT = `你是专业的简历解析助手。把用户发来的简历纯文本解析为结构化 JSON，只输出 JSON 本身，不要输出任何解释或 markdown 代码块。

输出格式（字段不能遗漏，没有的信息用空字符串 ""，没有条目的模块用空数组 []）：
{
  "profile": {
    "name": "", "gender": "", "birthday": "", "city": "", "idType": "", "idNumber": "",
    "phone": "", "email": "", "wechat": "", "github": "", "homepage": "", "portfolio": "", "website": "", "linkedin": "",
    "emergencyContact": "", "emergencyPhone": "",
    "school": "", "college": "", "major": "", "degree": "", "educationStart": "", "educationEnd": "", "mainCourses": "",
    "nativePlace": "", "politicalStatus": "", "address": "",
    "jobIntent": "", "expectedCity": "", "expectedSalary": "", "availableDate": "",
    "skills": "技能标签，用 / 分隔，例如：React / TypeScript / Node.js",
    "advantages": "个人优势/自我评价，每行一条",
    "otherInfo": "无法归类的其他信息，每行一条"
  },
  "experiences": [
    { "type": "internship", "company": "", "title": "", "role": "", "start": "YYYY-MM", "end": "YYYY-MM 或 至今", "description": "职责与成果，每行一条，保留量化数据" }
  ],
  "certificates": [ { "name": "", "date": "", "description": "" } ],
  "awards": [ { "name": "", "date": "", "description": "" } ],
  "academicWorks": [ { "name": "", "date": "", "description": "" } ],
  "languages": [ { "language": "", "level": "", "score": "" } ],
  "campusExperience": [ { "name": "", "role": "", "start": "", "end": "", "description": "" } ]
}

要求：
- experiences 的 type 只能是：internship=实习经历，work=全职/工作经历，project=项目/个人作品/竞赛项目
- 实习/工作填 company，项目填 title，不要两个都填
- 日期统一 YYYY-MM 格式；在读/在职的结束时间填 至今
- 严格忠于原文，不要编造原文没有的信息；双栏/表格排版的简历请自行理顺阅读顺序`;
  async function aiParseResume(rawText, apiKey, model) {
    const response = await chrome.runtime.sendMessage({
      type: 'DEEPSEEK_PARSE',
      apiKey,
      model,
      systemPrompt: AI_SYSTEM_PROMPT,
      resumeText: String(rawText || '').slice(0, 12000)
    });
    if (!response?.ok) throw new Error(response?.error || 'AI 请求失败');
    const content = String(response.content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    if (!content) throw new Error('AI 返回了空内容（可能被思考模式占满额度）');
    try {
      return JSON.parse(content);
    } catch {
      throw new Error(`AI 返回的不是合法 JSON：${content.slice(0, 120)}`);
    }
  }
  function mergeAiParsed(localParsed, ai) {
    const profile = { ...(localParsed?.profile || {}) };
    const aiProfile = ai?.profile || {};
    // 标量字段：AI 优先，空值保留本地结果
    [...BASIC_FIELDS.map((f) => f.key), 'skills', 'advantages', 'otherInfo'].forEach((key) => {
      const value = aiProfile[key];
      if (typeof value === 'string' && value.trim()) profile[key] = value.trim();
    });
    // 记录型模块：AI 返回数组，转成存储格式
    ['certificates', 'awards', 'academicWorks', 'languages', 'campusExperience'].forEach((key) => {
      const list = Array.isArray(ai?.[key]) ? ai[key] : [];
      const saved = saveRecords(list, byKey(MODULES, key).fields);
      if (saved) profile[key] = saved;
    });
    // 经历：AI 有结果就用 AI 的，没有保留本地
    let experiences = localParsed?.experiences || [];
    if (Array.isArray(ai?.experiences) && ai.experiences.length) {
      const aiExp = ai.experiences.map((x) => ({
        type: ['internship', 'project', 'work'].includes(x?.type) ? x.type : 'project',
        title: String(x?.title || ''),
        company: String(x?.company || ''),
        role: String(x?.role || ''),
        start: normalizeDate(x?.start || ''),
        end: normalizeDate(x?.end || ''),
        description: String(x?.description || '')
      })).filter((x) => Object.values(x).some((v) => String(v || '').trim()));
      if (aiExp.length) experiences = aiExp;
    }
    return { profile, experiences, rawText: localParsed?.rawText || '' };
  }
  async function handleImport(file) {
    const debug = [];
    if (!file) return;
    debug.push(`文件名: ${file.name || '(empty)'}`);
    debug.push(`后缀检查: ${/\\.docx$/i.test(file.name || '') ? '通过' : '失败'}`);
    if (!/\.docx$/i.test(file.name || '')) {
      setImportDebug(debug);
      toast('当前仅支持 .docx 文件', true);
      return;
    }

    const mammoth = globalThis.mammoth || window.mammoth;
    debug.push(`mammoth: ${mammoth?.extractRawText ? '已加载' : '缺失'}`);
    if (!mammoth?.extractRawText) {
      setImportDebug(debug);
      toast('解析器未加载完成，请关闭后重新打开浮窗再试', true);
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      debug.push(`arrayBuffer: ${arrayBuffer?.byteLength || 0} bytes`);
      let rawText = '';

      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value || '';
        debug.push(`extractRawText: 成功 (${rawText.length} chars)`);
      } catch (extractError) {
        debug.push(`extractRawText: 失败 -> ${String(extractError?.message || extractError)}`);
        console.warn('extractRawText failed, fallback to convertToHtml', extractError);
        try {
          const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
          const temp = document.createElement('div');
          temp.innerHTML = htmlResult.value || '';
          rawText = (temp.textContent || temp.innerText || '').replace(/\u00a0/g, ' ');
          debug.push(`convertToHtml: 成功 (${rawText.length} chars)`);
        } catch (htmlError) {
          debug.push(`convertToHtml: 失败 -> ${String(htmlError?.message || htmlError)}`);
          console.warn('convertToHtml failed, fallback to JSZip XML', htmlError);
          debug.push(`JSZip: ${(globalThis.JSZip || window.JSZip)?.loadAsync ? '已加载' : '缺失'}`);
          rawText = await extractDocxTextWithZip(arrayBuffer);
          debug.push(`JSZip XML: 成功 (${rawText.length} chars)`);
        }
      }

      let parsed = parseResumeText(rawText || '');
      debug.push(`parseResumeText: 成功 (本地规则)`);
      const aiSettings = await chrome.storage.local.get([AI_KEY, AI_ENABLED_KEY, AI_MODEL_KEY]);
      if (aiSettings[AI_ENABLED_KEY] && aiSettings[AI_KEY]) {
        try {
          debug.push('AI 解析: 请求 DeepSeek 中...');
          setImportDebug([...debug]);
          const progress = toastProgress('⏳ AI 解析中，通常需要 5-20 秒…');
          const aiStartedAt = Date.now();
          try {
            const aiData = await aiParseResume(rawText, aiSettings[AI_KEY], aiSettings[AI_MODEL_KEY] || AI_MODEL_DEFAULT);
            parsed = mergeAiParsed(parsed, aiData);
            const cost = Math.round((Date.now() - aiStartedAt) / 1000);
            debug.push(`AI 解析: 成功 (${cost}s)`);
            progress.done(`✅ AI 解析完成（${cost}s）`);
          } catch (aiError) {
            console.warn('AI parse failed, fallback to local', aiError);
            debug.push(`AI 解析: 失败（已使用本地结果）-> ${String(aiError?.message || aiError)}`);
            progress.fail(`AI 解析失败，已使用本地识别结果：${String(aiError?.message || aiError)}`);
          }
        } catch (outerError) {
          console.warn(outerError);
        }
      } else if (aiSettings[AI_ENABLED_KEY] && !aiSettings[AI_KEY]) {
        debug.push('AI 解析: 已开启但未填写 API Key，已使用本地识别');
        toast('AI 开关已开但没填 API Key，本次使用本地识别', true);
      }
      const prevState = await getState();
      const editable = mergeImportedEditable(prevState.editable, buildEditable(parsed));
      debug.push('合并策略: 简历命中项已覆盖，手动填写的其余字段已保留');
      skipStorageRenderCount += 1;
      await chrome.storage.local.set({
        resumeParsed: parsed,
        resumeEditable: editable,
        resumeFlattened: flattenEditable(editable),
        resumeUpdatedAt: Date.now()
      });
      setImportDebug(debug);
      toast('简历已导入');
      // 导入完成自动跳到「预览」页，实时查看解析结果
      currentView = 'preview';
      const panelEl = document.getElementById(PANEL_ID);
      if (panelEl) {
        panelEl.querySelector('#raf-preview-tab')?.classList.add('active');
        panelEl.querySelector('#raf-edit-tab')?.classList.remove('active');
        panelEl.querySelector('#raf-settings-tab')?.classList.remove('active');
      }
      await chrome.storage.local.set({ [VIEW_KEY]: 'preview' });
      if (listRoot) renderCurrentView(listRoot);
    } catch (error) {
      console.error(error);
      const msg = String(error?.message || '');
      debug.push(`最终异常: ${msg || '未知错误'}`);
      setImportDebug(debug);
      if (/context invalidated/i.test(msg)) {
        toast('扩展刚更新过，请刷新当前网页后重试', true);
      } else if (/zip|central directory|end of central directory/i.test(msg)) {
        toast(`文件内容不像有效的 .docx：${msg}`, true);
      } else if (msg) {
        toast(`docx 解析失败：${msg}`, true);
      } else {
        toast('docx 解析失败：出现未知错误，请查看扩展控制台', true);
      }
    }
  }
  async function clearData() { skipStorageRenderCount += 1; await chrome.storage.local.remove(STORAGE_KEYS); if (listRoot) renderCurrentView(listRoot, { preserveScroll: true }); toast('数据已清空'); }
  function card(label, value, onClick, extra = '') { const wrap = document.createElement('div'); wrap.className = `raf-field-wrap ${extra}`.trim(); const title = document.createElement('div'); title.className = 'raf-field-title'; title.textContent = label; wrap.appendChild(title); const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'raf-item'; btn.innerHTML = `<span class="raf-card-value">${value ? truncate(value) : "<span class='raf-placeholder'>未识别</span>"}</span>`; btn.addEventListener('click', onClick); wrap.appendChild(btn); return wrap; }
  function bindTextareaThumb(textarea, thumb) {
    let dragging = false;
    let startY = 0;
    let startScrollTop = 0;

    const updateThumb = () => {
      const scrollHeight = textarea.scrollHeight;
      const clientHeight = textarea.clientHeight;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      if (scrollHeight <= clientHeight + 1) {
        thumb.style.opacity = '0';
        return;
      }
      const minThumb = 20;
      const trackHeight = Math.max(1, clientHeight - 6);
      const thumbHeight = Math.max(minThumb, Math.round((clientHeight / scrollHeight) * trackHeight));
      const thumbTravel = Math.max(1, trackHeight - thumbHeight);
      const top = Math.round((textarea.scrollTop / maxScroll) * thumbTravel);
      thumb.style.height = `${thumbHeight}px`;
      thumb.style.transform = `translateY(${3 + top}px)`;
      thumb.style.opacity = '1';
    };

    textarea.addEventListener('scroll', updateThumb);
    textarea.addEventListener('input', updateThumb);
    requestAnimationFrame(updateThumb);

    thumb.addEventListener('mousedown', (e) => {
      dragging = true;
      startY = e.clientY;
      startScrollTop = textarea.scrollTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const scrollHeight = textarea.scrollHeight;
      const clientHeight = textarea.clientHeight;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      const trackHeight = Math.max(1, clientHeight - 6);
      const thumbHeight = Math.max(20, Math.round((clientHeight / scrollHeight) * trackHeight));
      const thumbTravel = Math.max(1, trackHeight - thumbHeight);
      const delta = e.clientY - startY;
      textarea.scrollTop = Math.max(0, Math.min(maxScroll, startScrollTop + (delta * maxScroll) / thumbTravel));
      updateThumb();
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }
  function inputField(field, value, onChange) {
    const row = document.createElement('div');
    row.className = `raf-edit-field${field.type === 'textarea' ? ' full' : ''}`;
    const title = document.createElement('div');
    title.className = 'raf-field-title';
    title.textContent = field.label;
    const el = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
    if (field.type !== 'textarea') el.type = field.type === 'date' ? 'date' : 'text';
    el.className = 'raf-edit-input';
    el.value = field.type === 'date' ? dateInput(value) : (value || '');
    el.placeholder = `请输入${field.label}`;
    el.addEventListener('input', (e) => onChange(e.target.value));
    row.appendChild(title);
    if (field.type === 'textarea') {
      const shell = document.createElement('div');
      shell.className = 'raf-textarea-shell';
      const thumb = document.createElement('div');
      thumb.className = 'raf-textarea-thumb';
      shell.appendChild(el);
      shell.appendChild(thumb);
      row.appendChild(shell);
      bindTextareaThumb(el, thumb);
    } else {
      row.appendChild(el);
    }
    return row;
  }
  // 模块折叠：点击模块头收起/展开，状态持久化（预览/编辑页共用同一 key）
  const COLLAPSE_KEY = 'rafCollapsedSections';
  let collapsedSections = new Set();
  function makeCollapsible(section, key) {
    const head = section.querySelector(':scope > .raf-module-head');
    if (!head) return;
    head.classList.add('raf-collapsible');
    const arrow = document.createElement('span');
    arrow.className = 'raf-collapse-arrow';
    head.insertBefore(arrow, head.firstChild);
    const sync = () => {
      const collapsed = collapsedSections.has(key);
      section.classList.toggle('raf-collapsed', collapsed);
      arrow.textContent = collapsed ? '▸' : '▾';
    };
    head.addEventListener('click', async (e) => {
      if (e.target.closest('button')) return; // 「添加一条」等按钮不触发折叠
      if (collapsedSections.has(key)) collapsedSections.delete(key); else collapsedSections.add(key);
      sync();
      await chrome.storage.local.set({ [COLLAPSE_KEY]: [...collapsedSections] });
    });
    sync();
  }
  function sectionHead(text, addText, onAdd) { const head = document.createElement('div'); head.className = 'raf-module-head'; const title = document.createElement('div'); title.className = 'raf-module-title'; title.textContent = text; head.appendChild(title); if (onAdd) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'raf-mini-btn'; btn.textContent = addText; btn.addEventListener('click', onAdd); head.appendChild(btn); } return head; }
  function delBtn(onClick) { const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'raf-link-btn'; btn.textContent = '删除'; btn.addEventListener('click', onClick); return btn; }
  function previewField(field, value) {
    const row = document.createElement('div');
    row.className = `raf-edit-field${field.type === 'textarea' ? ' full' : ''}`;
    const title = document.createElement('div');
    title.className = 'raf-field-title';
    title.textContent = field.label;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'raf-preview-value';
    btn.textContent = value;
    btn.addEventListener('click', () => fillToActive(value));
    row.appendChild(title);
    row.appendChild(btn);
    return row;
  }
  function filled(value) { return String(value || '').trim(); }
  const focusTargetSelector = (target) => {
    if (!target) return '';
    if (target.kind === 'experience') return `[data-raf-kind="experience"][data-raf-group="${target.group}"][data-raf-index="${target.index}"]`;
    if (target.kind === 'record') return `[data-raf-kind="record"][data-raf-module="${target.module}"][data-raf-index="${target.index}"]`;
    if (target.kind === 'tag') return `[data-raf-kind="tag"][data-raf-module="${target.module}"][data-raf-index="${target.index}"]`;
    if (target.kind === 'bullet') return `[data-raf-kind="bullet"][data-raf-module="${target.module}"][data-raf-index="${target.index}"]`;
    if (target.kind === 'custom') return `[data-raf-kind="custom"][data-raf-index="${target.index}"]`;
    return '';
  };
  function renderSettingsView(root) {
    const wrap = document.createElement('div');
    wrap.className = 'raf-settings-view';

    const noteSection = document.createElement('section');
    noteSection.className = 'raf-edit-section raf-settings-section raf-settings-note-section';
    noteSection.appendChild(sectionHead('chaunyoffer'));
    const noteCard = document.createElement('div');
    noteCard.className = 'raf-setting-card';
    const noteMeta = document.createElement('div');
    noteMeta.className = 'raf-setting-meta raf-setting-meta-centered';
    noteMeta.innerHTML = `<strong>朋友我祝你简历过过过！</strong><span>别忘了关注昂——川页Chauny</span>`;
    noteCard.appendChild(noteMeta);
    noteSection.appendChild(noteCard);
    wrap.appendChild(noteSection);

    const toolsSection = document.createElement('section');
    toolsSection.className = 'raf-edit-section raf-settings-section raf-settings-tools';
    const toolsRow = document.createElement('div');
    toolsRow.className = 'raf-edit-tools-row';

    const importLabel = document.createElement('label');
    importLabel.className = 'raf-glass-btn';
    importLabel.innerHTML = '<span>导入简历</span>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.docx';
    fileInput.hidden = true;
    fileInput.addEventListener('change', async () => {
      await handleImport(fileInput.files?.[0]);
      fileInput.value = '';
    });
    importLabel.appendChild(fileInput);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'raf-glass-btn';
    clearBtn.textContent = '清空数据';
    clearBtn.addEventListener('click', async () => {
      await clearData();
      if (listRoot) renderCurrentView(listRoot, { preserveScroll: true });
    });

    toolsRow.appendChild(importLabel);
    toolsRow.appendChild(clearBtn);
    toolsSection.appendChild(toolsRow);
    wrap.appendChild(toolsSection);

    // AI 深度解析（DeepSeek BYOK）
    const aiSection = document.createElement('section');
    aiSection.className = 'raf-edit-section raf-settings-section';
    aiSection.appendChild(sectionHead('AI 深度解析'));
    const aiCard = document.createElement('div');
    aiCard.className = 'raf-setting-card';
    const aiMeta = document.createElement('div');
    aiMeta.className = 'raf-setting-meta';
    aiMeta.innerHTML = `<strong>接入你自己的 DeepSeek API Key</strong><span>开启后，导入简历会同时调用 DeepSeek 解析，识别率更高；自动填充时也会对本地规则匹配不上的页面字段做语义兜底，失败会自动回落本地结果。Key 只保存在本地浏览器。注意：简历文本与页面字段标签将发送到 DeepSeek API。申请地址：platform.deepseek.com</span>`;
    aiCard.appendChild(aiMeta);
    const keyInput = document.createElement('input');
    keyInput.className = 'raf-edit-input';
    keyInput.type = 'password';
    keyInput.placeholder = 'sk-...';
    keyInput.autocomplete = 'off';
    aiCard.appendChild(keyInput);
    const aiToggle = document.createElement('label');
    aiToggle.className = 'raf-pin';
    aiToggle.style.width = 'fit-content';
    const aiToggleInput = document.createElement('input');
    aiToggleInput.type = 'checkbox';
    aiToggle.appendChild(aiToggleInput);
    aiToggle.appendChild(document.createTextNode(' 导入简历时启用 AI 解析'));
    aiCard.appendChild(aiToggle);
    const modelRow = document.createElement('div');
    modelRow.className = 'raf-setting-control';
    const modelLabel = document.createElement('span');
    modelLabel.textContent = '模型';
    modelLabel.style.cssText = 'font-size:12px;color:#6f6f6f;font-weight:700;';
    const modelSelect = document.createElement('select');
    modelSelect.className = 'raf-edit-input';
    modelSelect.style.cssText = 'flex:1;min-height:34px;padding:6px 10px;';
    [['deepseek-v4-pro', 'deepseek-v4-pro（更准，推荐）'], ['deepseek-v4-flash', 'deepseek-v4-flash（更快更便宜）']].forEach(([value, text]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      modelSelect.appendChild(opt);
    });
    modelRow.appendChild(modelLabel);
    modelRow.appendChild(modelSelect);
    aiCard.appendChild(modelRow);
    aiSection.appendChild(aiCard);
    wrap.appendChild(aiSection);

    chrome.storage.local.get([AI_KEY, AI_ENABLED_KEY, AI_MODEL_KEY]).then((data) => {
      keyInput.value = data[AI_KEY] || '';
      aiToggleInput.checked = !!data[AI_ENABLED_KEY];
      modelSelect.value = data[AI_MODEL_KEY] || AI_MODEL_DEFAULT;
    });
    keyInput.addEventListener('input', async () => {
      await chrome.storage.local.set({ [AI_KEY]: keyInput.value.trim() });
    });
    keyInput.addEventListener('change', async () => {
      const value = keyInput.value.trim();
      await chrome.storage.local.set({ [AI_KEY]: value });
      toast(value ? 'API Key 已保存' : 'API Key 已清除');
    });
    aiToggleInput.addEventListener('change', async () => {
      await chrome.storage.local.set({ [AI_ENABLED_KEY]: aiToggleInput.checked });
      toast(aiToggleInput.checked ? 'AI 解析已开启' : 'AI 解析已关闭');
    });
    modelSelect.addEventListener('change', async () => {
      await chrome.storage.local.set({ [AI_MODEL_KEY]: modelSelect.value });
      toast(`已切换模型：${modelSelect.value}`);
    });

    // 提示音设置
    const soundSection = document.createElement('section');
    soundSection.className = 'raf-edit-section raf-settings-section';
    soundSection.appendChild(sectionHead('提示音'));
    const soundCard = document.createElement('div');
    soundCard.className = 'raf-setting-card';
    const soundMeta = document.createElement('div');
    soundMeta.className = 'raf-setting-meta';
    soundMeta.innerHTML = `<strong>填充结果提示音</strong><span>自动填充结束后按结果播放不同提示音：全部填入 / 部分未填 / 填入失败。</span>`;
    soundCard.appendChild(soundMeta);
    const soundToggle = document.createElement('label');
    soundToggle.className = 'raf-pin';
    soundToggle.style.width = 'fit-content';
    const soundToggleInput = document.createElement('input');
    soundToggleInput.type = 'checkbox';
    soundToggleInput.checked = soundEnabled;
    soundToggle.appendChild(soundToggleInput);
    soundToggle.appendChild(document.createTextNode(' 开启提示音'));
    soundCard.appendChild(soundToggle);

    // 音量调节
    const volumeRow = document.createElement('div');
    volumeRow.className = 'raf-setting-control';
    const volumeLabel = document.createElement('span');
    volumeLabel.style.cssText = 'font-size:12px;color:#6f6f6f;font-weight:700;';
    volumeLabel.textContent = '音量';
    const volumeValue = document.createElement('span');
    volumeValue.style.cssText = 'font-size:12px;color:#6f6f6f;min-width:38px;text-align:right;';
    volumeValue.textContent = `${soundVolume}%`;
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.step = '5';
    volumeSlider.value = String(soundVolume);
    volumeSlider.className = 'raf-slider';
    volumeSlider.style.flex = '1';
    volumeSlider.addEventListener('input', () => {
      soundVolume = Number(volumeSlider.value);
      volumeValue.textContent = `${soundVolume}%`;
    });
    volumeSlider.addEventListener('change', async () => {
      soundVolume = Number(volumeSlider.value);
      await chrome.storage.local.set({ [SOUND_VOLUME_KEY]: soundVolume });
      playFeedbackSound('complete'); // 松手试听当前音量
    });
    volumeRow.appendChild(volumeLabel);
    volumeRow.appendChild(volumeSlider);
    volumeRow.appendChild(volumeValue);
    soundCard.appendChild(volumeRow);
    soundSection.appendChild(soundCard);
    wrap.appendChild(soundSection);
    soundToggleInput.addEventListener('change', async () => {
      soundEnabled = soundToggleInput.checked;
      await chrome.storage.local.set({ [SOUND_KEY]: soundEnabled });
      toast(soundEnabled ? '提示音已开启' : '提示音已关闭');
      if (soundEnabled) playFeedbackSound('complete'); // 开启时试听一声
    });

    const panelSection = document.createElement('section');
    panelSection.className = 'raf-edit-section raf-settings-section';
    panelSection.appendChild(sectionHead('显示设置'));
    const brightnessRow = document.createElement('div');
    brightnessRow.className = 'raf-setting-row';

    const settingMeta = document.createElement('div');
    settingMeta.className = 'raf-setting-meta';
    settingMeta.innerHTML = `<strong>界面亮度</strong>`;
    brightnessRow.appendChild(settingMeta);

    const settingControl = document.createElement('div');
    settingControl.className = 'raf-setting-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(toUiPercent(panelBrightness, 70, 130));
    slider.className = 'raf-slider';

    slider.addEventListener('input', (e) => {
      const next = fromUiPercent(Number(e.target.value), 70, 130);
      applyPanelBrightness(document.getElementById(PANEL_ID), next);
    });

    slider.addEventListener('change', async (e) => {
      const next = fromUiPercent(Number(e.target.value), 70, 130);
      applyPanelBrightness(document.getElementById(PANEL_ID), next);
      await chrome.storage.local.set({ [BRIGHTNESS_KEY]: panelBrightness });
    });

    settingControl.appendChild(slider);
    brightnessRow.appendChild(settingControl);
    panelSection.appendChild(brightnessRow);

    const opacityRow = document.createElement('div');
    opacityRow.className = 'raf-setting-row';
    const opacityMeta = document.createElement('div');
    opacityMeta.className = 'raf-setting-meta';
    opacityMeta.innerHTML = `<strong>背景不透明度</strong>`;
    opacityRow.appendChild(opacityMeta);
    const opacityControl = document.createElement('div');
    opacityControl.className = 'raf-setting-control';
    const opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.step = '1';
    opacitySlider.value = String(panelOpacity);
    opacitySlider.className = 'raf-slider';
    opacitySlider.addEventListener('input', (e) => {
      const next = Number(e.target.value);
      applyPanelOpacity(document.getElementById(PANEL_ID), next);
    });
    opacitySlider.addEventListener('change', async (e) => {
      const next = Number(e.target.value);
      applyPanelOpacity(document.getElementById(PANEL_ID), next);
      await chrome.storage.local.set({ [OPACITY_KEY]: panelOpacity });
    });
    opacityControl.appendChild(opacitySlider);
    opacityRow.appendChild(opacityControl);
    panelSection.appendChild(opacityRow);

    const satRow = document.createElement('div');
    satRow.className = 'raf-setting-row';
    const satMeta = document.createElement('div');
    satMeta.className = 'raf-setting-meta';
    satMeta.innerHTML = `<strong>玻璃色彩饱和度</strong>`;
    satRow.appendChild(satMeta);
    const satControl = document.createElement('div');
    satControl.className = 'raf-setting-control';
    const satSlider = document.createElement('input');
    satSlider.type = 'range';
    satSlider.min = '0';
    satSlider.max = '10000';
    satSlider.step = '1';
    satSlider.value = String(glassSaturation);
    satSlider.className = 'raf-slider';
    satSlider.addEventListener('input', (e) => {
      applyGlassSaturation(document.getElementById(PANEL_ID), Number(e.target.value));
    });
    satSlider.addEventListener('change', async (e) => {
      applyGlassSaturation(document.getElementById(PANEL_ID), Number(e.target.value));
      await chrome.storage.local.set({ [GLASS_SAT_KEY]: glassSaturation });
    });
    satControl.appendChild(satSlider);
    satRow.appendChild(satControl);
    panelSection.appendChild(satRow);

    const widthRow = document.createElement('div');
    widthRow.className = 'raf-setting-row';
    const widthMeta = document.createElement('div');
    widthMeta.className = 'raf-setting-meta';
    widthMeta.innerHTML = `<strong>面板宽度</strong>`;
    widthRow.appendChild(widthMeta);
    const widthControl = document.createElement('div');
    widthControl.className = 'raf-setting-control';
    const widthSlider = document.createElement('input');
    widthSlider.type = 'range';
    widthSlider.min = '0';
    widthSlider.max = '100';
    widthSlider.step = '1';
    widthSlider.value = String(toUiPercent(panelWidthPercent, PANEL_WIDTH_PERCENT_MIN, PANEL_WIDTH_PERCENT_MAX));
    widthSlider.className = 'raf-slider';
    widthSlider.addEventListener('input', (e) => {
      const next = fromUiPercent(Number(e.target.value), PANEL_WIDTH_PERCENT_MIN, PANEL_WIDTH_PERCENT_MAX);
      applyPanelSize(document.getElementById(PANEL_ID), next, panelHeightPercent);
    });
    widthSlider.addEventListener('change', async (e) => {
      const next = fromUiPercent(Number(e.target.value), PANEL_WIDTH_PERCENT_MIN, PANEL_WIDTH_PERCENT_MAX);
      applyPanelSize(document.getElementById(PANEL_ID), next, panelHeightPercent);
      await chrome.storage.local.set({ [WIDTH_KEY]: panelWidthPercent });
    });
    widthControl.appendChild(widthSlider);
    widthRow.appendChild(widthControl);
    panelSection.appendChild(widthRow);

    const heightRow = document.createElement('div');
    heightRow.className = 'raf-setting-row';
    const heightMeta = document.createElement('div');
    heightMeta.className = 'raf-setting-meta';
    heightMeta.innerHTML = `<strong>面板高度</strong>`;
    heightRow.appendChild(heightMeta);
    const heightControl = document.createElement('div');
    heightControl.className = 'raf-setting-control';
    const heightSlider = document.createElement('input');
    heightSlider.type = 'range';
    heightSlider.min = '0';
    heightSlider.max = '100';
    heightSlider.step = '1';
    heightSlider.value = String(toUiPercent(panelHeightPercent, PANEL_HEIGHT_PERCENT_MIN, PANEL_HEIGHT_PERCENT_MAX));
    heightSlider.className = 'raf-slider';
    heightSlider.addEventListener('input', (e) => {
      const next = fromUiPercent(Number(e.target.value), PANEL_HEIGHT_PERCENT_MIN, PANEL_HEIGHT_PERCENT_MAX);
      applyPanelSize(document.getElementById(PANEL_ID), panelWidthPercent, next);
    });
    heightSlider.addEventListener('change', async (e) => {
      const next = fromUiPercent(Number(e.target.value), PANEL_HEIGHT_PERCENT_MIN, PANEL_HEIGHT_PERCENT_MAX);
      applyPanelSize(document.getElementById(PANEL_ID), panelWidthPercent, next);
      await chrome.storage.local.set({ [HEIGHT_KEY]: panelHeightPercent });
    });
    heightControl.appendChild(heightSlider);
    heightRow.appendChild(heightControl);
    panelSection.appendChild(heightRow);

    // 日志框：导入/自动填充的诊断记录，常驻设置页底部
    const dbgSection = document.createElement('section');
    dbgSection.className = 'raf-edit-section raf-settings-section';
    dbgSection.appendChild(sectionHead('日志'));
    const dbgCard = document.createElement('div');
    dbgCard.className = 'raf-setting-card';
    const dbgMeta = document.createElement('div');
    dbgMeta.className = 'raf-setting-meta';
    dbgMeta.innerHTML = `<strong>导入与填充诊断</strong><span>最近一次导入简历 / 自动填充的详细过程记录，识别问题可复制后反馈。</span>`;
    dbgCard.appendChild(dbgMeta);
    const debug = document.createElement('div');
    debug.className = 'raf-debug';
    debug.innerHTML = importDebug.length
      ? importDebug.map((x) => `<div>${x}</div>`).join('')
      : '<div>暂无日志：导入简历或运行一次自动填充后，这里会显示详细过程。</div>';
    dbgCard.appendChild(debug);
    dbgSection.appendChild(dbgCard);
    wrap.appendChild(dbgSection);

    wrap.appendChild(panelSection);
    root.appendChild(wrap);
  }
  async function renderPreviewView(root, nonce) {
    const { editable } = await getState();
    const state = moduleState(editable);
    const form = document.createElement('div');
    form.className = 'raf-edit-view raf-preview-view';

    const basicValues = BASIC_FIELDS.filter((field) => filled(editable.profile[field.key]));
    if (basicValues.length) {
      const basicSection = document.createElement('section');
      basicSection.className = 'raf-edit-section raf-basic-section';
      basicSection.appendChild(sectionHead('基础信息'));
      const grid = document.createElement('div');
      grid.className = 'raf-edit-grid';
      basicValues.forEach((field) => grid.appendChild(previewField(field, editable.profile[field.key])));
      basicSection.appendChild(grid);
      makeCollapsible(basicSection, 'basic');
      form.appendChild(basicSection);
    }

    EXP_GROUPS.forEach((group) => {
      const items = (editable.experiences[group.key] || []).filter((item) => Object.values(item || {}).some((v) => filled(v)));
      if (!items.length) return;
      const section = document.createElement('section');
      section.className = 'raf-edit-section raf-lite-section';
      section.appendChild(sectionHead(group.label));
      items.forEach((item, i) => {
        const entry = document.createElement('div');
        entry.className = 'raf-edit-entry';
        const head = document.createElement('div');
        head.className = 'raf-edit-entry-head';
        const strong = document.createElement('strong');
        strong.textContent = `${group.label}${i + 1}`;
        head.appendChild(strong);
        entry.appendChild(head);
        const grid = document.createElement('div');
        grid.className = 'raf-edit-grid';
        group.fields.forEach((field) => {
          if (!filled(item[field.key])) return;
          grid.appendChild(previewField(field, item[field.key]));
        });
        if (grid.children.length) entry.appendChild(grid);
        section.appendChild(entry);
      });
      makeCollapsible(section, `exp:${group.key}`);
      form.appendChild(section);
    });

    MODULES.forEach((mod) => {
      if (mod.kind === 'tags') {
        const items = (state[mod.key] || []).map((x) => filled(x)).filter(Boolean);
        if (!items.length) return;
        const section = document.createElement('section');
        section.className = 'raf-edit-section raf-lite-section';
        section.appendChild(sectionHead(mod.label));
        const list = document.createElement('div');
        list.className = 'raf-inline-list';
        items.forEach((tag, i) => {
          const row = document.createElement('div');
          row.className = 'raf-inline-row single';
          row.appendChild(previewField({ label: `标签${i + 1}`, type: 'text' }, tag));
          list.appendChild(row);
        });
        section.appendChild(list);
        makeCollapsible(section, `mod:${mod.key}`);
        form.appendChild(section);
        return;
      }
      if (mod.kind === 'bullets') {
        const items = (state[mod.key] || []).map((x) => filled(x)).filter(Boolean);
        if (!items.length) return;
        const section = document.createElement('section');
        section.className = 'raf-edit-section raf-lite-section';
        section.appendChild(sectionHead(mod.label));
        const list = document.createElement('div');
        list.className = 'raf-inline-list';
        items.forEach((line, i) => {
          const row = document.createElement('div');
          row.className = 'raf-inline-row single';
          row.appendChild(previewField({ label: `${mod.label}${i + 1}`, type: 'text' }, line));
          list.appendChild(row);
        });
        section.appendChild(list);
        makeCollapsible(section, `mod:${mod.key}`);
        form.appendChild(section);
        return;
      }
      const records = (state[mod.key] || []).filter((rec) => Object.values(rec || {}).some((v) => filled(v)));
      if (!records.length) return;
      const section = document.createElement('section');
      section.className = 'raf-edit-section raf-lite-section';
      section.appendChild(sectionHead(mod.label));
      records.forEach((item, i) => {
        const entry = document.createElement('div');
        entry.className = 'raf-edit-entry';
        const head = document.createElement('div');
        head.className = 'raf-edit-entry-head';
        const strong = document.createElement('strong');
        strong.textContent = `${mod.label}${i + 1}`;
        head.appendChild(strong);
        entry.appendChild(head);
        const grid = document.createElement('div');
        grid.className = 'raf-edit-grid';
        mod.fields.forEach((field) => {
          if (!filled(item[field.key])) return;
          grid.appendChild(previewField(field, item[field.key]));
        });
        if (grid.children.length) entry.appendChild(grid);
        section.appendChild(entry);
      });
      makeCollapsible(section, `mod:${mod.key}`);
      form.appendChild(section);
    });

    // 扩展字段预览：只展示有内容的条目（点击写入页面活动输入框）
    const customItems = (editable.customFields || []).filter((cf) => filled(cf?.content));
    if (customItems.length) {
      const section = document.createElement('section');
      section.className = 'raf-edit-section raf-lite-section';
      section.appendChild(sectionHead('扩展字段'));
      const grid = document.createElement('div');
      grid.className = 'raf-edit-grid';
      customItems.forEach((cf) => grid.appendChild(previewField({ label: filled(cf.title) || '扩展字段', type: 'textarea' }, String(cf.content).trim())));
      section.appendChild(grid);
      makeCollapsible(section, 'custom');
      form.appendChild(section);
    }

    if (nonce !== renderNonce) return;
    if (!form.children.length) {
      root.innerHTML = "<div class='raf-empty'>切换到“编辑”后导入简历，这里会展示最终预览与填充卡片。</div>";
    } else {
      root.appendChild(form);
    }
  }
  function renderTags(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加标签', async () => { items.push(''); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'tag', module: mod.key, index: items.length - 1 } }); })); const wrap = document.createElement('div'); wrap.className = 'raf-tag-list'; items.forEach((item, i) => { const chip = document.createElement('div'); chip.className = 'raf-tag-edit'; chip.dataset.rafKind = 'tag'; chip.dataset.rafModule = mod.key; chip.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-tag-input'; input.value = item; input.placeholder = '请输入标签'; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); chip.appendChild(input); chip.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); wrap.appendChild(chip); }); makeCollapsible(section, `mod:${mod.key}`); section.appendChild(wrap); form.appendChild(section); }
  function renderBullets(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(''); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'bullet', module: mod.key, index: items.length - 1 } }); })); const list = document.createElement('div'); list.className = 'raf-inline-list'; items.forEach((item, i) => { const row = document.createElement('div'); row.className = 'raf-inline-row'; row.dataset.rafKind = 'bullet'; row.dataset.rafModule = mod.key; row.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-edit-input'; input.value = item; input.placeholder = `请输入${mod.label}`; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); row.appendChild(input); row.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); list.appendChild(row); }); makeCollapsible(section, `mod:${mod.key}`); section.appendChild(list); form.appendChild(section); }
  function renderRecords(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'record', module: mod.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'record'; entry.dataset.rafModule = mod.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${mod.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; mod.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; syncModules(editable, state); await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); makeCollapsible(section, `mod:${mod.key}`); form.appendChild(section); }
  // 扩展字段：用户自定义「标题 + 内容」（都选填），AI 按标题语义匹配网页表单填入内容
  function renderCustomFields(form, editable, root) {
    if (!Array.isArray(editable.customFields)) editable.customFields = [];
    const items = editable.customFields;
    const section = document.createElement('section');
    section.className = 'raf-edit-section raf-lite-section';
    section.appendChild(sectionHead('扩展字段', '添加一条', async () => {
      items.push({ title: '', content: '' });
      await persist(editable, { skipRender: true });
      renderCurrentView(root, { focusTarget: { kind: 'custom', index: items.length - 1 } });
    }));
    if (!items.length) {
      const hint = document.createElement('div');
      hint.className = 'raf-empty';
      hint.textContent = '固定字段不够用时加一条：填了标题和内容后，填充时会按标题匹配网页表单，把内容填进去。';
      section.appendChild(hint);
    }
    items.forEach((item, i) => {
      const entry = document.createElement('div');
      entry.className = 'raf-edit-entry';
      entry.dataset.rafKind = 'custom';
      entry.dataset.rafIndex = String(i);
      const head = document.createElement('div');
      head.className = 'raf-edit-entry-head';
      const strong = document.createElement('strong');
      strong.textContent = filled(item.title) || `字段${i + 1}`;
      head.appendChild(strong);
      head.appendChild(delBtn(async () => {
        const fixedScrollTop = root.scrollTop;
        items.splice(i, 1);
        await persist(editable, { skipRender: true });
        renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop });
      }));
      entry.appendChild(head);
      const grid = document.createElement('div');
      grid.className = 'raf-edit-grid';
      grid.appendChild(inputField({ key: 'title', label: '标题', type: 'text' }, item.title, async (next) => { item.title = next; await persist(editable); }));
      grid.appendChild(inputField({ key: 'content', label: '内容', type: 'textarea' }, item.content, async (next) => { item.content = next; await persist(editable); }));
      entry.appendChild(grid);
      section.appendChild(entry);
    });
    makeCollapsible(section, 'custom');
    form.appendChild(section);
  }
  function renderExperiences(form, editable, root) { EXP_GROUPS.forEach((group) => { const items = editable.experiences[group.key] || []; if (!items.length) items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(group.label, '添加一条', async () => { items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'experience', group: group.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'experience'; entry.dataset.rafGroup = group.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${group.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; const idx = items.indexOf(item); if (idx >= 0) items.splice(idx, 1); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; group.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); makeCollapsible(section, `exp:${group.key}`); form.appendChild(section); }); }
  function renderEditTools(form, root) {
    const section = document.createElement('section');
    section.className = 'raf-edit-section raf-edit-tools';
    const row = document.createElement('div');
    row.className = 'raf-edit-tools-row';
    const importLabel = document.createElement('label');
    importLabel.className = 'raf-glass-btn';
    importLabel.innerHTML = '<span>导入简历</span>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.docx';
    fileInput.hidden = true;
    fileInput.addEventListener('change', async () => {
      await handleImport(fileInput.files?.[0]);
      fileInput.value = '';
    });
    importLabel.appendChild(fileInput);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'raf-glass-btn';
    clearBtn.textContent = '清空数据';
    clearBtn.addEventListener('click', async () => {
      await clearData();
      renderCurrentView(root, { preserveScroll: true });
    });
    row.appendChild(importLabel);
    row.appendChild(clearBtn);
    section.appendChild(row);
    form.appendChild(section);
  }
  async function renderEditView(root, nonce, hostRoot = root) {
    const { editable } = await getState();
    if (nonce !== renderNonce) return;
    const state = moduleState(editable);
    const form = document.createElement('div');
    form.className = 'raf-edit-view';

    const basicSection = document.createElement('section');
    basicSection.className = 'raf-edit-section raf-basic-section';
    basicSection.appendChild(sectionHead('基础信息'));
    const grid = document.createElement('div');
    grid.className = 'raf-edit-grid';
    BASIC_FIELDS.forEach((field) => grid.appendChild(inputField(field, editable.profile[field.key], async (next) => {
      editable.profile[field.key] = next;
      await persist(editable);
    })));
    basicSection.appendChild(grid);
    makeCollapsible(basicSection, 'basic');
    form.appendChild(basicSection);

    renderExperiences(form, editable, hostRoot);
    MODULES.forEach((mod) => {
      if (mod.kind === 'tags') renderTags(form, mod, state, editable, hostRoot);
      else if (mod.kind === 'bullets') renderBullets(form, mod, state, editable, hostRoot);
      else renderRecords(form, mod, state, editable, hostRoot);
    });
    renderCustomFields(form, editable, hostRoot);

    if (nonce !== renderNonce) return;
    root.appendChild(form);
  }
  async function renderCurrentView(root, options = {}) {
    listRoot = root;
    const nonce = ++renderNonce;
    const previousScrollTop = options.preserveScroll ? (typeof options.scrollTop === 'number' ? options.scrollTop : root.scrollTop) : 0;
    try {
      const staging = document.createElement('div');
      if (currentView === 'edit') await renderEditView(staging, nonce, root);
      else if (currentView === 'settings') renderSettingsView(staging);
      else await renderPreviewView(staging, nonce);
      if (nonce !== renderNonce) return;
      root.replaceChildren(...staging.childNodes);
    } catch (err) {
      // 渲染绝不能静默失败：否则视图卡在上一个页面，表现为「切换栏失灵」。
      console.error('[chaunyoffer] render failed:', err);
      if (nonce !== renderNonce) return;
      const invalidated = /context invalidated/i.test(String(err?.message || err));
      const box = document.createElement('div');
      box.className = 'raf-empty';
      box.textContent = invalidated ? '扩展刚更新过，请刷新本网页后重试。' : `页面渲染失败：${err?.message || err}。可尝试「编辑 → 清空数据」或刷新网页。`;
      root.replaceChildren(box);
      if (invalidated) toast('扩展刚更新过，请刷新当前网页后重试', true);
      return;
    }
    if (options.focusTarget) {
      requestAnimationFrame(() => {
        if (nonce !== renderNonce) return;
        const selector = focusTargetSelector(options.focusTarget);
        const target = selector ? root.querySelector(selector) : null;
        if (target) {
          const top = Math.max(0, target.offsetTop - 16);
          root.scrollTop = top;
          const focusable = target.querySelector('input, textarea');
          if (focusable) focusable.focus();
        }
      });
    } else if (options.preserveScroll) {
      requestAnimationFrame(() => {
        if (nonce !== renderNonce) return;
        root.scrollTop = Math.min(previousScrollTop, Math.max(0, root.scrollHeight - root.clientHeight));
      });
    }
  }
  async function savePanelState(panel) {
    try {
      await chrome.storage.local.set({ [PIN_KEY]: pinned, [POS_KEY]: { left: panel.style.left, top: panel.style.top }, [VIEW_KEY]: currentView, [BRIGHTNESS_KEY]: panelBrightness, [OPACITY_KEY]: panelOpacity, [WIDTH_KEY]: panelWidthPercent, [HEIGHT_KEY]: panelHeightPercent, [GLASS_SAT_KEY]: glassSaturation });
    } catch (err) {
      // 扩展重载/更新后旧页面的 content script 会失效（Extension context invalidated），
      // 存储失败不应阻断 UI 交互。
      console.warn('[chaunyoffer] savePanelState failed:', err);
    }
  }
  async function applyPinState(panel, checked) {
    const rect = panel.getBoundingClientRect();
    pinned = checked;
    panel.style.position = pinned ? 'fixed' : 'absolute';
    if (!pinned) {
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top + window.scrollY}px`;
    }
    clampPanelIntoViewport(panel);
    await savePanelState(panel);
  }
  async function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.left = '20px';
    panel.style.top = '90px';
    panel.innerHTML = `<div class="raf-head"><div class="raf-head-top"><div class="raf-actions"><div class="raf-mode-group"><button id="raf-preview-tab" class="raf-tab active" type="button">预览</button><button id="raf-edit-tab" class="raf-tab" type="button">编辑</button><button id="raf-settings-tab" class="raf-tab" type="button">设置</button><button id="raf-pin-btn" class="raf-tab" type="button">固定</button><button id="raf-close" class="raf-tab raf-close-tab" type="button">关闭</button></div></div></div><div class="raf-autofill-bar"><label class="raf-switch" title="自动填充总开关（全局生效，所有网站统一）"><input type="checkbox" id="raf-autofill-toggle"><span class="raf-switch-track"></span></label><span class="raf-autofill-text">自动填充</span><button id="raf-autofill-run" class="raf-autofill-run" type="button">识别并填充本页</button></div></div><div class="raf-drag-blur" aria-hidden="true"></div><div id="raf-list" class="raf-list"></div>`;
    document.body.appendChild(panel);

    const listEl = panel.querySelector('#raf-list');
    const settingsTab = panel.querySelector('#raf-settings-tab');
    const pinBtn = panel.querySelector('#raf-pin-btn');
    const closeEl = panel.querySelector('#raf-close');
    const previewTab = panel.querySelector('#raf-preview-tab');
    const editTab = panel.querySelector('#raf-edit-tab');
    const autofillToggle = panel.querySelector('#raf-autofill-toggle');
    const autofillRun = panel.querySelector('#raf-autofill-run');
    const syncAutofillBar = () => {
      autofillToggle.checked = autofillEnabled;
      autofillRun.disabled = !autofillEnabled;
    };
    const applyToolbarByView = () => {
      const isSettings = currentView === 'settings';
      const isEdit = currentView === 'edit';
      settingsTab.classList.toggle('active', isSettings);
      previewTab.classList.toggle('active', !isEdit && !isSettings);
      editTab.classList.toggle('active', isEdit);
      pinBtn.classList.toggle('active', !!pinned);
      settingsTab.setAttribute('aria-pressed', String(isSettings));
      previewTab.setAttribute('aria-pressed', String(!isEdit && !isSettings));
      editTab.setAttribute('aria-pressed', String(isEdit));
      pinBtn.setAttribute('aria-pressed', String(!!pinned));
      closeEl.setAttribute('aria-pressed', 'false');
    };

    const stored = await chrome.storage.local.get([PIN_KEY, POS_KEY, VIEW_KEY, BRIGHTNESS_KEY, OPACITY_KEY, WIDTH_KEY, HEIGHT_KEY, GLASS_SAT_KEY, AUTOFILL_KEY, SOUND_KEY, SOUND_VOLUME_KEY, COLLAPSE_KEY]);
    if (stored[POS_KEY]?.left) panel.style.left = stored[POS_KEY].left;
    if (stored[POS_KEY]?.top) panel.style.top = stored[POS_KEY].top;
    pinned = stored[PIN_KEY] !== false;
    currentView = stored[VIEW_KEY] || 'preview';
    autofillEnabled = !!stored[AUTOFILL_KEY];
    soundEnabled = stored[SOUND_KEY] !== false;
    collapsedSections = new Set(Array.isArray(stored[COLLAPSE_KEY]) ? stored[COLLAPSE_KEY] : []);
    soundVolume = Math.max(0, Math.min(100, Number(stored[SOUND_VOLUME_KEY] ?? 100) || 0));
    {
      const parsedGlassSat = Number(stored[GLASS_SAT_KEY]);
      glassSaturation = Math.max(0, Math.min(10000, Number.isFinite(parsedGlassSat) ? parsedGlassSat : 20));
    }
    applyPanelBrightness(panel, stored[BRIGHTNESS_KEY] ?? 100);
    applyPanelOpacity(panel, stored[OPACITY_KEY] ?? 0);
    applyGlassSaturation(panel, glassSaturation);
    applyPanelSize(panel, stored[WIDTH_KEY] ?? 100, stored[HEIGHT_KEY] ?? 100);
    syncPanelLayout(panel);
    applyToolbarByView();
    syncAutofillBar();

    await applyPinState(panel, pinned);
    await renderCurrentView(listEl);
    syncPanelLayout(panel);

    settingsTab.addEventListener('click', () => {
      currentView = 'settings';
      applyToolbarByView();
      renderCurrentView(listEl);
      savePanelState(panel);
    });

    previewTab.addEventListener('click', () => {
      currentView = 'preview';
      applyToolbarByView();
      renderCurrentView(listEl);
      savePanelState(panel);
    });

    editTab.addEventListener('click', () => {
      currentView = 'edit';
      applyToolbarByView();
      renderCurrentView(listEl);
      savePanelState(panel);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[AUTOFILL_KEY]) {
        autofillEnabled = !!changes[AUTOFILL_KEY].newValue;
        syncAutofillBar();
      }
      if (area === 'local' && changes[SOUND_KEY]) {
        soundEnabled = changes[SOUND_KEY].newValue !== false;
      }
      if (area === 'local' && changes[SOUND_VOLUME_KEY]) {
        soundVolume = Math.max(0, Math.min(100, Number(changes[SOUND_VOLUME_KEY].newValue ?? 100) || 0));
      }
      if (area === 'local' && (changes.resumeFlattened || changes.resumeEditable || changes.resumeParsed) && listRoot === listEl) {
        if (skipStorageRenderCount > 0) {
          skipStorageRenderCount -= 1;
          return;
        }
        renderCurrentView(listEl, { preserveScroll: true });
      }
    });

    pinBtn.addEventListener('click', async () => {
      await applyPinState(panel, !pinned);
      applyToolbarByView();
      toast(pinned ? '已固定在屏幕' : '已取消固定，可随页面滚动');
    });
    autofillToggle.addEventListener('change', async () => {
      autofillEnabled = autofillToggle.checked;
      await chrome.storage.local.set({ [AUTOFILL_KEY]: autofillEnabled });
      syncAutofillBar();
      toast(autofillEnabled ? '自动填充已开启（全局生效）' : '自动填充已关闭');
    });
    autofillRun.addEventListener('click', () => { primeFeedbackAudio(); runAutofill(); });
    closeEl.addEventListener('click', (e) => { e.stopPropagation(); panelVisible = false; updatePanelVisibility(); });
    closeEl.addEventListener('mousedown', (e) => e.stopPropagation());
    settingsTab.addEventListener('mousedown', (e) => e.stopPropagation());
    previewTab.addEventListener('mousedown', (e) => e.stopPropagation());
    editTab.addEventListener('mousedown', (e) => e.stopPropagation());
    pinBtn.addEventListener('mousedown', (e) => e.stopPropagation());

    const beginDrag = (e) => {
      drag = { x: e.clientX, y: e.clientY, left: panel.offsetLeft, top: panel.offsetTop };
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      e.preventDefault();
    };

    // 整块底板可拖动：命中内容块 / 交互控件 / 滚动条时不触发
    const NO_DRAG_SELECTOR = 'input, textarea, select, button, a, label, [contenteditable], .raf-edit-section, .raf-debug, .raf-tip, .raf-status';
    panel.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element) || !panel.contains(t)) return;
      if (t.closest(NO_DRAG_SELECTOR)) return;
      if (e.offsetX >= t.clientWidth || e.offsetY >= t.clientHeight) return; // 滚动条区域
      beginDrag(e);
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      panel.style.left = `${Math.max(0, drag.left + e.clientX - drag.x)}px`;
      panel.style.top = `${Math.max(0, drag.top + e.clientY - drag.y)}px`;
    });
    document.addEventListener('mouseup', async () => {
      if (!drag) return;
      drag = null;
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      await savePanelState(panel);
    });
    window.addEventListener('resize', () => {
      syncPanelLayout(panel);
      clampPanelIntoViewport(panel);
    });
    return panel;
  }
  await ensurePanel();
  panelVisible = false;
  updatePanelVisibility();
})();

