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

  let panelVisible = false, pinned = true, currentView = 'preview', drag = null, lastActiveEditable = null, listRoot = null, panelBrightness = 100, panelOpacity = 0, panelWidthPercent = 100, panelHeightPercent = 100, glassSaturation = 20;
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
  const withDefaults = (parsed) => ({ profile: { ...Object.fromEntries(BASIC_FIELDS.map((f) => [f.key, ''])), advantages:'',skills:'',certificates:'',awards:'',academicWorks:'',languages:'',campusExperience:'',otherInfo:'', ...(parsed.profile || {}) }, experiences: { internship:[], project:[], work:[], ...Object.fromEntries(EXP_GROUPS.map((g) => [g.key, []])) }, moduleDrafts: {} });
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
  async function getState() { const data = await chrome.storage.local.get(STORAGE_KEYS); const parsed = data.resumeParsed || { profile:{}, experiences:[], rawText:'' }; const editable = data.resumeEditable || buildEditable(parsed); return { parsed, editable, flattened: data.resumeFlattened || flattenEditable(editable) }; }
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
  function toastProgress(msg) {
    const panel = document.getElementById(PANEL_ID);
    const host = panel || document.body;
    const tip = document.createElement('div');
    tip.className = 'raf-tip progress';
    tip.textContent = msg;
    host.appendChild(tip);
    if (panel) {
      const index = panel.querySelectorAll(':scope > .raf-tip').length - 1;
      tip.style.top = `${12 + Math.max(0, index) * 48}px`;
    }
    return {
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
  function setImportDebug(lines) { importDebug = lines; if (listRoot && currentView === 'preview') renderCurrentView(listRoot, { preserveScroll: true }); }
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
      const editable = buildEditable(parsed);
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
    aiMeta.innerHTML = `<strong>接入你自己的 DeepSeek API Key</strong><span>开启后，导入简历会同时调用 DeepSeek 解析，识别率更高；失败会自动回落本地规则。Key 只保存在本地浏览器。注意：简历文本将发送到 DeepSeek API。申请地址：platform.deepseek.com</span>`;
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
      form.appendChild(section);
    });

    if (nonce !== renderNonce) return;
    if (!form.children.length) {
      root.innerHTML = "<div class='raf-empty'>切换到“编辑”后导入简历，这里会展示最终预览与填充卡片。</div>";
    } else {
      root.appendChild(form);
    }
    if (nonce !== renderNonce) return;
    if (importDebug.length) {
      const debug = document.createElement('div');
      debug.className = 'raf-debug';
      debug.innerHTML = importDebug.map((x) => `<div>${x}</div>`).join('');
      root.appendChild(debug);
    }
  }
  function renderTags(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加标签', async () => { items.push(''); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'tag', module: mod.key, index: items.length - 1 } }); })); const wrap = document.createElement('div'); wrap.className = 'raf-tag-list'; items.forEach((item, i) => { const chip = document.createElement('div'); chip.className = 'raf-tag-edit'; chip.dataset.rafKind = 'tag'; chip.dataset.rafModule = mod.key; chip.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-tag-input'; input.value = item; input.placeholder = '请输入标签'; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); chip.appendChild(input); chip.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); wrap.appendChild(chip); }); section.appendChild(wrap); form.appendChild(section); }
  function renderBullets(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(''); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'bullet', module: mod.key, index: items.length - 1 } }); })); const list = document.createElement('div'); list.className = 'raf-inline-list'; items.forEach((item, i) => { const row = document.createElement('div'); row.className = 'raf-inline-row'; row.dataset.rafKind = 'bullet'; row.dataset.rafModule = mod.key; row.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-edit-input'; input.value = item; input.placeholder = `请输入${mod.label}`; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); row.appendChild(input); row.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); list.appendChild(row); }); section.appendChild(list); form.appendChild(section); }
  function renderRecords(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'record', module: mod.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'record'; entry.dataset.rafModule = mod.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${mod.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; items.splice(i, 1); syncModules(editable, state); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; mod.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; syncModules(editable, state); await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); form.appendChild(section); }
  function renderExperiences(form, editable, root) { EXP_GROUPS.forEach((group) => { const items = editable.experiences[group.key] || []; if (!items.length) items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(group.label, '添加一条', async () => { items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); await persist(editable, { skipRender: true }); renderCurrentView(root, { focusTarget: { kind: 'experience', group: group.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'experience'; entry.dataset.rafGroup = group.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${group.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { const fixedScrollTop = root.scrollTop; const idx = items.indexOf(item); if (idx >= 0) items.splice(idx, 1); await persist(editable, { skipRender: true }); renderCurrentView(root, { preserveScroll: true, scrollTop: fixedScrollTop }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; group.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); form.appendChild(section); }); }
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
    form.appendChild(basicSection);

    renderExperiences(form, editable, hostRoot);
    MODULES.forEach((mod) => {
      if (mod.kind === 'tags') renderTags(form, mod, state, editable, hostRoot);
      else if (mod.kind === 'bullets') renderBullets(form, mod, state, editable, hostRoot);
      else renderRecords(form, mod, state, editable, hostRoot);
    });

    if (nonce !== renderNonce) return;
    root.appendChild(form);
  }
  async function renderCurrentView(root, options = {}) {
    listRoot = root;
    const nonce = ++renderNonce;
    const previousScrollTop = options.preserveScroll ? (typeof options.scrollTop === 'number' ? options.scrollTop : root.scrollTop) : 0;
    const staging = document.createElement('div');
    if (currentView === 'edit') await renderEditView(staging, nonce, root);
    else if (currentView === 'settings') renderSettingsView(staging);
    else await renderPreviewView(staging, nonce);
    if (nonce !== renderNonce) return;
    root.replaceChildren(...staging.childNodes);
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
  async function savePanelState(panel) { await chrome.storage.local.set({ [PIN_KEY]: pinned, [POS_KEY]: { left: panel.style.left, top: panel.style.top }, [VIEW_KEY]: currentView, [BRIGHTNESS_KEY]: panelBrightness, [OPACITY_KEY]: panelOpacity, [WIDTH_KEY]: panelWidthPercent, [HEIGHT_KEY]: panelHeightPercent, [GLASS_SAT_KEY]: glassSaturation }); }
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
    panel.innerHTML = `<div class="raf-head"><div class="raf-head-top"><div class="raf-actions"><div class="raf-mode-group"><button id="raf-preview-tab" class="raf-tab active" type="button">预览</button><button id="raf-edit-tab" class="raf-tab" type="button">编辑</button><button id="raf-settings-tab" class="raf-tab" type="button">设置</button><button id="raf-pin-btn" class="raf-tab" type="button">固定</button><button id="raf-close" class="raf-tab raf-close-tab" type="button">关闭</button></div></div></div></div><div class="raf-drag-blur" aria-hidden="true"></div><div id="raf-list" class="raf-list"></div>`;
    document.body.appendChild(panel);

    const listEl = panel.querySelector('#raf-list');
    const settingsTab = panel.querySelector('#raf-settings-tab');
    const pinBtn = panel.querySelector('#raf-pin-btn');
    const closeEl = panel.querySelector('#raf-close');
    const previewTab = panel.querySelector('#raf-preview-tab');
    const editTab = panel.querySelector('#raf-edit-tab');
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

    const stored = await chrome.storage.local.get([PIN_KEY, POS_KEY, VIEW_KEY, BRIGHTNESS_KEY, OPACITY_KEY, WIDTH_KEY, HEIGHT_KEY, GLASS_SAT_KEY]);
    if (stored[POS_KEY]?.left) panel.style.left = stored[POS_KEY].left;
    if (stored[POS_KEY]?.top) panel.style.top = stored[POS_KEY].top;
    pinned = stored[PIN_KEY] !== false;
    currentView = stored[VIEW_KEY] || 'preview';
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

    await applyPinState(panel, pinned);
    await renderCurrentView(listEl);
    syncPanelLayout(panel);

    settingsTab.addEventListener('click', async () => {
      currentView = 'settings';
      applyToolbarByView();
      await savePanelState(panel);
      renderCurrentView(listEl);
    });

    previewTab.addEventListener('click', async () => {
      currentView = 'preview';
      applyToolbarByView();
      await savePanelState(panel);
      renderCurrentView(listEl);
    });

    editTab.addEventListener('click', async () => {
      currentView = 'edit';
      applyToolbarByView();
      await savePanelState(panel);
      renderCurrentView(listEl);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
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

