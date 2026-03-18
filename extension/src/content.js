(async () => {
  if (window.__resumeAutoFillInjected) return;
  window.__resumeAutoFillInjected = true;

  const PANEL_ID = 'resume-autofill-panel';
  const POS_KEY = 'rafPanelPosition';
  const PIN_KEY = 'rafPanelPinned';
  const VIEW_KEY = 'rafPanelView';
  const STORAGE_KEYS = ['resumeParsed', 'resumeFlattened', 'resumeEditable', 'resumeUpdatedAt'];
  const BASIC_FIELDS = [
    ['name','姓名','text'],['gender','性别','text'],['birthday','出生日期','date'],['city','所在城市','text'],['idType','证件类型','text'],['idNumber','证件号码','text'],
    ['phone','手机号','text'],['email','邮箱','text'],['wechat','微信号','text'],['emergencyContact','紧急联系人','text'],['emergencyPhone','紧急联系方式','text'],['school','学校','text'],
    ['college','学院','text'],['major','专业','text'],['degree','学历','text'],['educationStart','入学时间','date'],['educationEnd','毕业时间','date'],['mainCourses','主修课程','textarea']
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

  let panelVisible = false, pinned = true, currentView = 'preview', drag = null, lastActiveEditable = null, listRoot = null;
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
    const m = compact.match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
    if (!m) return String(value).trim();
    return `${m[1]}-${m[2].padStart(2, '0')}-${(m[3] || '01').padStart(2, '0')}`;
  };
  const EDUCATION_HINT = /(教育经历|学校|学院|专业|学历|主修课程|入学时间|毕业时间|本科|硕士|博士|专科|研究生)/;
  const parseInlineEducation = (line) => {
    const clean = String(line || '').replace(/\s+/g, ' ').trim();
    if (!clean || !EDUCATION_HINT.test(clean)) return null;
    const dates = [...clean.matchAll(/(20\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?)/g)].map((m) => normalizeDate(m[1]));
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
    const inline = parseInlineEducation(educationBlock || text);
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
  function parseResumeText(rawText) {
    const text = String(rawText || '').replace(/\r/g, '').trim();
    const blocks = splitBlocks(text);
    const profile = {
      name: pickByRegex(text, /姓名[:：]\s*([^\n]+)/),
      gender: pickByRegex(text, /性别[:：]\s*([^\n]+)/),
      birthday: normalizeDate(pickByRegex(text, /(?:出生日期|生日)[:：]\s*([^\n]+)/)),
      city: pickByRegex(text, /(?:所在城市|现居地)[:：]\s*([^\n]+)/),
      idType: pickByRegex(text, /证件类型[:：]\s*([^\n]+)/) || '身份证',
      idNumber: pickByRegex(text, /(?:证件号码|身份证号)[:：]\s*([^\n]+)/),
      phone: pickByRegex(text, /(?:手机号|电话|手机)[:：]?\s*(1\d{10})/) || pickByRegex(text, /(1\d{10})/),
      email: pickByRegex(text, /(?:邮箱|Email|E-mail)[:：]?\s*([^\s\n]+)/i),
      wechat: pickByRegex(text, /(?:微信号|微信)[:：]\s*([^\n]+)/),
      emergencyContact: pickByRegex(text, /紧急联系人[:：]\s*([^\n]+)/),
      emergencyPhone: pickByRegex(text, /紧急联系方式[:：]\s*([^\n]+)/),
      ...parseEducation(text, blocks)
    };

    const experiences = [];
    let currentType = 'project';
    let current = null;
    const lines = text.split(/\n/).map((x) => x.trim()).filter(Boolean);
    for (const line of lines) {
      if (EDUCATION_HINT.test(line)) continue;
      if (/(项目经历|实习经历|工作经历)/.test(line)) {
        currentType = /实习/.test(line) ? 'internship' : /工作/.test(line) ? 'work' : 'project';
        if (current && Object.values(current).some(Boolean)) experiences.push(current);
        current = null;
        continue;
      }
      const titleMatch = line.match(/^(\d{4}[.-]\d{1,2}.*?)(?:\s{2,}|\t+)(.+?)(?:\s{2,}|\t+)(.+)$/);
      if (titleMatch) {
        if (EDUCATION_HINT.test(titleMatch[2]) || EDUCATION_HINT.test(titleMatch[3])) continue;
        if (current && Object.values(current).some(Boolean)) experiences.push(current);
        current = {
          type: currentType,
          title: currentType === 'project' ? titleMatch[2].trim() : '',
          company: currentType === 'project' ? '' : titleMatch[2].trim(),
          role: titleMatch[3].trim(),
          start: normalizeDate((titleMatch[1].match(/(\d{4}[.-]\d{1,2})/) || [])[1] || ''),
          end: normalizeDate((titleMatch[1].match(/-(\d{4}[.-]\d{1,2}|至今|present)/i) || [])[1] || ''),
          description: ''
        };
        continue;
      }
      const mini = line.match(/^(公司名称|项目名称|职位|角色|开始时间|结束时间|描述)[:：]\s*(.+)$/);
      if (mini) {
        if (!current) current = { type: currentType, title: '', company: '', role: '', start: '', end: '', description: '' };
        const keyMap = { 公司名称: 'company', 项目名称: 'title', 职位: 'role', 角色: 'role', 开始时间: 'start', 结束时间: 'end', 描述: 'description' };
        const key = keyMap[mini[1]];
        const value = /时间/.test(mini[1]) ? normalizeDate(mini[2]) : mini[2].trim();
        current[key] = key === 'description' && current.description ? `${current.description}\n${value}` : value;
        continue;
      }
      if (/^[•·\-]/.test(line) || current) {
        if (!current) current = { type: currentType, title: '', company: '', role: '', start: '', end: '', description: '' };
        current.description = `${current.description}${current.description ? '\n' : ''}${line.replace(/^[•·\-]\s*/, '')}`;
      }
    }
    if (current && Object.values(current).some(Boolean)) experiences.push(current);
    return { profile, experiences, rawText: text, blocks };
  }
  function decodeXmlText(xml) {
    return String(xml || '')
      .replace(/<w:tab\/>/g, '\t')
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
  const moduleState = (editable) => ({
    skills: tags(editable.profile.skills), advantages: bullets(editable.profile.advantages), otherInfo: bullets(editable.profile.otherInfo),
    certificates: parseRecords(editable.profile.certificates, byKey(MODULES, 'certificates').fields), awards: parseRecords(editable.profile.awards, byKey(MODULES, 'awards').fields),
    academicWorks: parseRecords(editable.profile.academicWorks, byKey(MODULES, 'academicWorks').fields), languages: parseRecords(editable.profile.languages, byKey(MODULES, 'languages').fields),
    campusExperience: parseRecords(editable.profile.campusExperience, byKey(MODULES, 'campusExperience').fields)
  });
  const syncModules = (editable, state) => {
    editable.profile.skills = saveTags(state.skills || []); editable.profile.advantages = saveBullets(state.advantages || []); editable.profile.otherInfo = saveBullets(state.otherInfo || []);
    ['certificates','awards','academicWorks','languages','campusExperience'].forEach((key) => editable.profile[key] = saveRecords(state[key] || [], byKey(MODULES, key).fields));
  };
  const withDefaults = (parsed) => ({ profile: { ...Object.fromEntries(BASIC_FIELDS.map((f) => [f.key, ''])), advantages:'',skills:'',certificates:'',awards:'',academicWorks:'',languages:'',campusExperience:'',otherInfo:'', ...(parsed.profile || {}) }, experiences: { internship:[], project:[], work:[], ...Object.fromEntries(EXP_GROUPS.map((g) => [g.key, []])) } });
  function buildEditable(parsed) { const editable = withDefaults(parsed || {}); (parsed.experiences || []).forEach((x) => { const text = `${x.title || ''} ${x.company || ''} ${x.role || ''} ${x.description || ''}`; const forcedProject = /(自主项目|个人项目|side project)/i.test(text); const type = forcedProject ? 'project' : (x.type || 'project'); editable.experiences[type].push({ title:x.title||'', role:x.role||'', company:x.company||'', start:x.start||'', end:x.end||'', description:x.description||'' }); }); return editable; }
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
  async function persist(editable) { const parsed = { profile: { ...editable.profile }, experiences: EXP_GROUPS.flatMap((g) => (editable.experiences[g.key] || []).filter((x) => Object.values(x).some(Boolean)).map((x) => ({ ...x, type:g.key, typeLabel:g.label }))), rawText: '' }; await chrome.storage.local.set({ resumeEditable: editable, resumeParsed: parsed, resumeFlattened: flattenEditable(editable), resumeUpdatedAt: Date.now() }); }
  const isEditable = (el) => el && (el.isContentEditable || el.tagName?.toLowerCase() === 'textarea' || (el.tagName?.toLowerCase() === 'input' && !['checkbox','radio','button','submit','file'].includes(el.type)));
  document.addEventListener('focusin', (e) => { const t = e.target; if (t instanceof HTMLElement && !t.closest(`#${PANEL_ID}`) && isEditable(t)) lastActiveEditable = t; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panelVisible = false; updatePanelVisibility(); } });
  chrome.runtime.onMessage.addListener((message) => { if (message?.type === 'RESUME_PANEL_OPEN') return ensurePanel().then(() => { panelVisible = true; updatePanelVisibility(); return { ok: true }; }); if (message?.type === 'RESUME_PANEL_HIDE') { panelVisible = false; updatePanelVisibility(); return Promise.resolve({ ok: true }); } });
  function setNativeValue(el, value) { const proto = Object.getPrototypeOf(el); const desc = Object.getOwnPropertyDescriptor(proto, 'value'); if (desc?.set) desc.set.call(el, value); else el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  async function copyValue(value) { try { await navigator.clipboard.writeText(value); return true; } catch { try { const ta = document.createElement('textarea'); ta.value = value; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch { return false; } } }
  function toast(msg, isError = false) { const tip = document.createElement('div'); tip.className = `raf-tip${isError ? ' err' : ''}`; tip.textContent = msg; document.body.appendChild(tip); setTimeout(() => tip.remove(), 1800); }
  function setImportDebug(lines) { importDebug = lines; if (listRoot && currentView === 'preview') renderCurrentView(listRoot, { preserveScroll: true }); }
  function updatePanelVisibility() { const panel = document.getElementById(PANEL_ID); if (panel) panel.style.display = panelVisible ? 'block' : 'none'; }
  async function fillToActive(value) { const copied = await copyValue(value); const target = document.activeElement && isEditable(document.activeElement) ? document.activeElement : lastActiveEditable; if (target && isEditable(target)) { if (target.isContentEditable) { target.focus(); document.execCommand('selectAll', false, null); document.execCommand('insertText', false, value); } else { target.focus(); setNativeValue(target, value); } toast(copied ? '已复制并写入输入框' : '已写入输入框'); return; } toast(copied ? '未找到输入框，内容已复制' : '请先点击目标输入框后再点字段', !copied); }
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

      const parsed = parseResumeText(rawText || '');
      debug.push(`parseResumeText: 成功`);
      const editable = buildEditable(parsed);
      await chrome.storage.local.set({
        resumeParsed: parsed,
        resumeEditable: editable,
        resumeFlattened: flattenEditable(editable),
        resumeUpdatedAt: Date.now()
      });
      setImportDebug(debug);
      toast('简历已导入');
      if (listRoot) renderCurrentView(listRoot, { preserveScroll: true });
    } catch (error) {
      console.error(error);
      const msg = String(error?.message || '');
      debug.push(`最终异常: ${msg || '未知错误'}`);
      setImportDebug(debug);
      if (/zip|central directory|end of central directory/i.test(msg)) {
        toast(`文件内容不像有效的 .docx：${msg}`, true);
      } else if (msg) {
        toast(`docx 解析失败：${msg}`, true);
      } else {
        toast('docx 解析失败：出现未知错误，请查看扩展控制台', true);
      }
    }
  }
  async function clearData() { await chrome.storage.local.remove(STORAGE_KEYS); if (listRoot) renderCurrentView(listRoot, { preserveScroll: true }); toast('数据已清空'); }
  function card(label, value, onClick, extra = '') { const wrap = document.createElement('div'); wrap.className = `raf-field-wrap ${extra}`.trim(); const title = document.createElement('div'); title.className = 'raf-field-title'; title.textContent = label; wrap.appendChild(title); const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'raf-item'; btn.innerHTML = `<span class="raf-card-value">${value ? truncate(value) : "<span class='raf-placeholder'>未识别</span>"}</span>`; btn.addEventListener('click', onClick); wrap.appendChild(btn); return wrap; }
  function inputField(field, value, onChange) { const row = document.createElement('div'); row.className = `raf-edit-field${field.type === 'textarea' ? ' full' : ''}`; const title = document.createElement('div'); title.className = 'raf-field-title'; title.textContent = field.label; const el = document.createElement(field.type === 'textarea' ? 'textarea' : 'input'); if (field.type !== 'textarea') el.type = field.type === 'date' ? 'date' : 'text'; el.className = 'raf-edit-input'; el.value = field.type === 'date' ? dateInput(value) : (value || ''); el.placeholder = `请输入${field.label}`; el.addEventListener('input', (e) => onChange(e.target.value)); row.appendChild(title); row.appendChild(el); return row; }
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
  async function renderPreviewView(root) {
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

    if (!form.children.length) {
      root.innerHTML = "<div class='raf-empty'>点击顶部“导入简历”后，就会在这里看到预览与填充卡片。</div>";
    } else {
      root.appendChild(form);
    }
    if (importDebug.length) {
      const debug = document.createElement('div');
      debug.className = 'raf-debug';
      debug.innerHTML = importDebug.map((x) => `<div>${x}</div>`).join('');
      root.appendChild(debug);
    }
  }
  function renderTags(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加标签', async () => { items.push(''); syncModules(editable, state); await persist(editable); renderCurrentView(root, { focusTarget: { kind: 'tag', module: mod.key, index: items.length - 1 } }); })); const wrap = document.createElement('div'); wrap.className = 'raf-tag-list'; items.forEach((item, i) => { const chip = document.createElement('div'); chip.className = 'raf-tag-edit'; chip.dataset.rafKind = 'tag'; chip.dataset.rafModule = mod.key; chip.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-tag-input'; input.value = item; input.placeholder = '请输入标签'; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); chip.appendChild(input); chip.appendChild(delBtn(async () => { items.splice(i, 1); syncModules(editable, state); await persist(editable); renderCurrentView(root, { preserveScroll: true }); })); wrap.appendChild(chip); }); section.appendChild(wrap); form.appendChild(section); }
  function renderBullets(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(''); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(''); syncModules(editable, state); await persist(editable); renderCurrentView(root, { focusTarget: { kind: 'bullet', module: mod.key, index: items.length - 1 } }); })); const list = document.createElement('div'); list.className = 'raf-inline-list'; items.forEach((item, i) => { const row = document.createElement('div'); row.className = 'raf-inline-row'; row.dataset.rafKind = 'bullet'; row.dataset.rafModule = mod.key; row.dataset.rafIndex = String(i); const input = document.createElement('input'); input.type = 'text'; input.className = 'raf-edit-input'; input.value = item; input.placeholder = `请输入${mod.label}`; input.addEventListener('input', async (e) => { items[i] = e.target.value; syncModules(editable, state); await persist(editable); }); row.appendChild(input); row.appendChild(delBtn(async () => { items.splice(i, 1); syncModules(editable, state); await persist(editable); renderCurrentView(root, { preserveScroll: true }); })); list.appendChild(row); }); section.appendChild(list); form.appendChild(section); }
  function renderRecords(form, mod, state, editable, root) { const items = state[mod.key] || []; if (!items.length) items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(mod.label, '添加一条', async () => { items.push(Object.fromEntries(mod.fields.map((f) => [f.key, '']))); syncModules(editable, state); await persist(editable); renderCurrentView(root, { focusTarget: { kind: 'record', module: mod.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'record'; entry.dataset.rafModule = mod.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${mod.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { items.splice(i, 1); syncModules(editable, state); await persist(editable); renderCurrentView(root, { preserveScroll: true }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; mod.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; syncModules(editable, state); await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); form.appendChild(section); }
  function renderExperiences(form, editable, root) { EXP_GROUPS.forEach((group) => { const items = editable.experiences[group.key] || []; if (!items.length) items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); const section = document.createElement('section'); section.className = 'raf-edit-section raf-lite-section'; section.appendChild(sectionHead(group.label, '添加一条', async () => { items.push(Object.fromEntries(group.fields.map((field) => [field.key, '']))); await persist(editable); renderCurrentView(root, { focusTarget: { kind: 'experience', group: group.key, index: items.length - 1 } }); })); items.forEach((item, i) => { const entry = document.createElement('div'); entry.className = 'raf-edit-entry'; entry.dataset.rafKind = 'experience'; entry.dataset.rafGroup = group.key; entry.dataset.rafIndex = String(i); const head = document.createElement('div'); head.className = 'raf-edit-entry-head'; const strong = document.createElement('strong'); strong.textContent = `${group.label}${i + 1}`; head.appendChild(strong); head.appendChild(delBtn(async () => { const idx = items.indexOf(item); if (idx >= 0) items.splice(idx, 1); await persist(editable); renderCurrentView(root, { preserveScroll: true }); })); entry.appendChild(head); const grid = document.createElement('div'); grid.className = 'raf-edit-grid'; group.fields.forEach((field) => grid.appendChild(inputField(field, item[field.key], async (next) => { item[field.key] = next; await persist(editable); }))); entry.appendChild(grid); section.appendChild(entry); }); form.appendChild(section); }); }
  async function renderEditView(root) {
    const { editable } = await getState();
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

    renderExperiences(form, editable, root);
    MODULES.forEach((mod) => {
      if (mod.kind === 'tags') renderTags(form, mod, state, editable, root);
      else if (mod.kind === 'bullets') renderBullets(form, mod, state, editable, root);
      else renderRecords(form, mod, state, editable, root);
    });

    root.appendChild(form);
  }
  async function renderCurrentView(root, options = {}) {
    listRoot = root;
    const previousScrollTop = options.preserveScroll ? root.scrollTop : 0;
    root.innerHTML = '';
    if (currentView === 'edit') await renderEditView(root); else await renderPreviewView(root);
    if (options.focusTarget) {
      requestAnimationFrame(() => {
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
        root.scrollTop = Math.min(previousScrollTop, Math.max(0, root.scrollHeight - root.clientHeight));
      });
    }
  }
  async function savePanelState(panel) { await chrome.storage.local.set({ [PIN_KEY]: pinned, [POS_KEY]: { left: panel.style.left, top: panel.style.top }, [VIEW_KEY]: currentView }); }
  async function applyPinState(panel, checked) { pinned = checked; panel.style.position = pinned ? 'fixed' : 'absolute'; if (!pinned) panel.style.top = `${window.scrollY + 90}px`; await savePanelState(panel); }
  async function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.left = '20px';
    panel.style.top = '90px';
    panel.innerHTML = `<div class="raf-head"><div class="raf-brand"><strong>chauny简历助手</strong></div><div class="raf-actions"><label class="raf-pin"><input id="raf-pin" type="checkbox" checked /> 固定屏幕</label><button id="raf-close" class="raf-close" type="button">关闭</button></div></div><div class="raf-toolbar"><div class="raf-toolbar-main"><label class="raf-import"><input id="raf-file" type="file" accept=".docx" hidden /><span>导入简历</span></label><button id="raf-clear" class="raf-mini-btn" type="button">清空数据</button></div><div class="raf-view-switch"><button id="raf-preview-tab" class="raf-tab active" type="button">预览</button><button id="raf-edit-tab" class="raf-tab" type="button">编辑</button></div></div><div id="raf-list" class="raf-list"></div>`;
    document.body.appendChild(panel);

    const listEl = panel.querySelector('#raf-list');
    const pinEl = panel.querySelector('#raf-pin');
    const closeEl = panel.querySelector('#raf-close');
    const fileEl = panel.querySelector('#raf-file');
    const clearEl = panel.querySelector('#raf-clear');
    const previewTab = panel.querySelector('#raf-preview-tab');
    const editTab = panel.querySelector('#raf-edit-tab');
    const toolbarMain = panel.querySelector('.raf-toolbar-main');

    const applyToolbarByView = () => {
      const isEdit = currentView === 'edit';
      previewTab.classList.toggle('active', !isEdit);
      editTab.classList.toggle('active', isEdit);
      toolbarMain.style.display = isEdit ? 'flex' : 'none';
    };

    const stored = await chrome.storage.local.get([PIN_KEY, POS_KEY, VIEW_KEY]);
    if (stored[POS_KEY]?.left) panel.style.left = stored[POS_KEY].left;
    if (stored[POS_KEY]?.top) panel.style.top = stored[POS_KEY].top;
    pinEl.checked = stored[PIN_KEY] !== false;
    currentView = stored[VIEW_KEY] || 'preview';
    applyToolbarByView();

    await applyPinState(panel, pinEl.checked);
    await renderCurrentView(listEl);

    fileEl.addEventListener('change', async () => { await handleImport(fileEl.files?.[0]); fileEl.value = ''; });
    clearEl.addEventListener('click', clearData);

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
        renderCurrentView(listEl, { preserveScroll: true });
      }
    });

    pinEl.addEventListener('change', async () => {
      await applyPinState(panel, pinEl.checked);
      toast(pinEl.checked ? '已固定在屏幕' : '已取消固定，可随页面滚动');
    });
    closeEl.addEventListener('click', (e) => { e.stopPropagation(); panelVisible = false; updatePanelVisibility(); });
    closeEl.addEventListener('mousedown', (e) => e.stopPropagation());

    const head = panel.querySelector('.raf-head');
    head.addEventListener('mousedown', (e) => {
      drag = { x: e.clientX, y: e.clientY, left: panel.offsetLeft, top: panel.offsetTop };
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      panel.style.left = `${Math.max(0, drag.left + e.clientX - drag.x)}px`;
      panel.style.top = `${Math.max(0, drag.top + e.clientY - drag.y)}px`;
    });
    document.addEventListener('mouseup', async () => {
      if (!drag) return;
      drag = null;
      await savePanelState(panel);
    });
    return panel;
  }
  await ensurePanel();
  panelVisible = false;
  updatePanelVisibility();
})();

