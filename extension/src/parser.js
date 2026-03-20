export const JD_FIELD_SCHEMA = [
  { key: "name", label: "姓名" },
  { key: "gender", label: "性别" },
  { key: "birthday", label: "出生日期" },
  { key: "city", label: "所在城市" },
  { key: "idType", label: "证件类型" },
  { key: "idNumber", label: "证件号码" },
  { key: "phone", label: "手机号" },
  { key: "email", label: "邮箱" },
  { key: "wechat", label: "微信号" },
  { key: "emergencyContact", label: "紧急联系人" },
  { key: "emergencyPhone", label: "紧急联系方式" },
  { key: "school", label: "学校" },
  { key: "college", label: "学院" },
  { key: "major", label: "专业" },
  { key: "degree", label: "学历" },
  { key: "educationStart", label: "入学时间" },
  { key: "educationEnd", label: "毕业时间" },
  { key: "mainCourses", label: "主修课程" }
];

function pickByRegex(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

function normalizeDate(value) {
  if (!value) return "";
  if (/^(至今|present)$/i.test(value.trim())) return "至今";
  const compact = value.replace(/[年./]/g, "-").replace(/月/g, "").replace(/日/g, "");
  const m = compact.match(/(\d{2,4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!m) return value.trim();
  const yearRaw = m[1];
  const y = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  const mon = m[2].padStart(2, "0");
  const d = (m[3] || "01").padStart(2, "0");
  return `${y}-${mon}-${d}`;
}

function splitBlocks(text) {
  return text
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const EDUCATION_HINT = /(教育经历|教育背景|学校|学院|专业|学历|主修课程|入学时间|毕业时间|本科|硕士|博士|专科|研究生)/;
const YEAR_MONTH = "(?:\\d{2}|(?:19|20)\\d{2})[./-]\\d{1,2}";
const PERIOD_PREFIX_RE = new RegExp(`^((?:${YEAR_MONTH})(?:\\s*(?:-|~|至|到)\\s*(?:${YEAR_MONTH}|至今|present))?)(.+)$`, "i");
const ROLE_TAIL_HINT = /(产品经理|AI产品经理|产品实习生|运营实习生|算法实习生|开发工程师|前端工程师|后端工程师|测试工程师|设计师|研究员|分析师|负责人|项目负责人|创始人|合伙人|经理|实习生)$/i;
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
  { key: "certificates", header: /^(证书|证书信息|资格证书|职业证书|资质证书)(?:[:：]?\s*)$/ },
  { key: "awards", header: /^(奖项|获奖信息|荣誉奖项|荣誉|获奖经历|奖项荣誉|获奖情况)(?:[:：]?\s*)$/ },
  { key: "academicWorks", header: /^(学术成果|科研成果|论文|发表论文|专利|论文专利|奖项论文专利)(?:[:：]?\s*)$/ },
  { key: "languages", header: /^(语言能力|语言|外语能力|语种能力)(?:[:：]?\s*)$/ },
  { key: "campusExperience", header: /^(校园经历|在校经历|校内经历|学生工作|社团经历|校园实践)(?:[:：]?\s*)$/ }
];

function isSectionHeader(line) {
  const text = String(line || "").trim();
  return SECTION_HEADER_RULES.some((rule) => rule.header.test(text)) || /(教育经历|教育背景|项目经历|工作经历|实习经历|技能|能力|优势|总结|其他信息|个人优势|专业技能|自我评价|个人总结|奖项荣誉|获奖情况|论文专利)/.test(text);
}

function collectSectionLines(text, key) {
  const rule = SECTION_HEADER_RULES.find((item) => item.key === key);
  if (!rule) return [];
  const lines = String(text || "").split(/\n/);
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
}

function lineHasDate(line) {
  return /(19|20)\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?/.test(line);
}

function parseSimpleRecords(lines, type) {
  const records = [];
  let current = null;
  const pushCurrent = () => {
    if (current && Object.values(current).some(Boolean)) records.push(current);
    current = null;
  };
  const createRecord = () => {
    if (type === "languages") return { language: "", level: "", score: "" };
    if (type === "campusExperience") return { name: "", role: "", start: "", end: "", description: "" };
    return { name: "", date: "", description: "" };
  };

  for (const rawLine of lines) {
    const line = String(rawLine || "").replace(/^[•·\-、\s]+/, "").trim();
    if (!line) {
      pushCurrent();
      continue;
    }
    if (type === "languages") {
      const pieces = line.split(/[，,、/|]/).map((x) => x.trim()).filter(Boolean);
      if (pieces.length >= 2 && !/[：:]/.test(line)) {
        records.push({ language: pieces[0] || "", level: pieces[1] || "", score: pieces.slice(2).join(" / ") });
        continue;
      }
      const direct = line.match(/^(中文|英语|日语|韩语|法语|德语|西班牙语|俄语|粤语|普通话|英语六级|英语四级|托福|雅思)(?:[:：\s-]+)?(.+)?$/i);
      if (direct) {
        records.push({ language: direct[1] || "", level: (direct[2] || "").trim(), score: "" });
        continue;
      }
      current = current || createRecord();
      if (/^(语言|语种)[:：]/.test(line)) current.language = line.replace(/^(语言|语种)[:：]\s*/, "");
      else if (/^(等级|水平)[:：]/.test(line)) current.level = line.replace(/^(等级|水平)[:：]\s*/, "");
      else if (/^(分数|成绩)[:：]/.test(line)) current.score = line.replace(/^(分数|成绩)[:：]\s*/, "");
      else current.level = [current.level, line].filter(Boolean).join(" / ");
      continue;
    }

    if (type === "campusExperience") {
      const periodMatch = line.match(/((?:19|20)\d{2}[./-]\d{1,2})(?:\s*(?:-|~|至|到)\s*((?:19|20)\d{2}[./-]\d{1,2}|至今|present))?/i);
      if (periodMatch && (!current || current.name || current.role || current.description)) {
        pushCurrent();
        current = createRecord();
        current.start = normalizeDate(periodMatch[1]);
        current.end = normalizeDate(periodMatch[2] || "");
        const rest = line.replace(periodMatch[0], "").trim();
        const parts = rest.split(/\s{2,}|\t+|\s+/).map((x) => x.trim()).filter(Boolean);
        current.name = parts[0] || "";
        current.role = parts.slice(1).join(" ");
        continue;
      }
      current = current || createRecord();
      if (/^(名称|活动|组织)[:：]/.test(line)) current.name = line.replace(/^(名称|活动|组织)[:：]\s*/, "");
      else if (/^(角色|职位|职务)[:：]/.test(line)) current.role = line.replace(/^(角色|职位|职务)[:：]\s*/, "");
      else if (/^(开始时间)[:：]/.test(line)) current.start = normalizeDate(line.replace(/^开始时间[:：]\s*/, ""));
      else if (/^(结束时间)[:：]/.test(line)) current.end = normalizeDate(line.replace(/^结束时间[:：]\s*/, ""));
      else if (!current.name) current.name = line;
      else if (!current.role && !lineHasDate(line) && line.length <= 24) current.role = line;
      else current.description = [current.description, line].filter(Boolean).join("\n");
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
      current.description = [current.description, line].filter(Boolean).join("\n");
      continue;
    }
    if (current.name && (current.date || current.description) && !/[：:]/.test(line) && !lineHasDate(line) && line.length <= 24) {
      pushCurrent();
      current = createRecord();
      current.name = line;
      continue;
    }
    if (/^(名称|证书|奖项|成果名称|论文|专利)[:：]/.test(line)) current.name = line.replace(/^(名称|证书|奖项|成果名称|论文|专利)[:：]\s*/, "");
    else if (/^(时间|日期|获得时间|发布时间)[:：]/.test(line)) current.date = normalizeDate(line.replace(/^(时间|日期|获得时间|发布时间)[:：]\s*/, ""));
    else if (!current.name) current.name = line;
    else current.description = [current.description, line].filter(Boolean).join("\n");
  }
  pushCurrent();
  return records;
}

function saveRecords(items, fields) {
  return (items || [])
    .filter((item) => Object.values(item || {}).some((value) => String(value || "").trim()))
    .map((item) => fields.map((field) => item[field.key] ? `${field.label}：${item[field.key]}` : "").filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function extractModuleProfile(text) {
  const fields = {
    certificates: [{ key: "name", label: "名称" }, { key: "date", label: "时间" }, { key: "description", label: "描述" }],
    awards: [{ key: "name", label: "名称" }, { key: "date", label: "时间" }, { key: "description", label: "描述" }],
    academicWorks: [{ key: "name", label: "成果名称" }, { key: "date", label: "发布时间" }, { key: "description", label: "描述" }],
    languages: [{ key: "language", label: "语言" }, { key: "level", label: "等级" }, { key: "score", label: "分数" }],
    campusExperience: [{ key: "name", label: "名称" }, { key: "role", label: "角色" }, { key: "start", label: "开始时间" }, { key: "end", label: "结束时间" }, { key: "description", label: "描述" }]
  };
  const result = Object.fromEntries(
    Object.keys(fields).map((key) => {
      const sectionLines = collectSectionLines(text, key);
      const records = parseSimpleRecords(sectionLines, key);
      return [key, saveRecords(records, fields[key])];
    })
  );
  const mixedLines = collectSectionLines(text, "academicWorks");
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
    if (awardRecords.length) result.awards = saveRecords(parseSimpleRecords(awardRecords, "awards"), fields.awards);
    if (academicRecords.length) result.academicWorks = saveRecords(parseSimpleRecords(academicRecords, "academicWorks"), fields.academicWorks);
    if (certRecords.length) result.certificates = saveRecords(parseSimpleRecords(certRecords, "certificates"), fields.certificates);
  }
  return result;
}

function parseInlineEducation(line) {
  const clean = String(line || "").replace(/\s+/g, " ").trim();
  if (!clean || !EDUCATION_HINT.test(clean)) return null;
  const dates = [...clean.matchAll(new RegExp(`(${YEAR_MONTH})`, "g"))].map((m) => normalizeDate(m[1]));
  const schoolMatch = clean.match(/((?:[\u4e00-\u9fa5A-Za-z0-9]+(?:大学|学院|学校|职业技术学院|职业学院|中学)))/);
  const degreeMatch = clean.match(/(博士研究生|硕士研究生|本科|硕士|博士|大专|专科)/);
  let major = "";
  if (schoolMatch) {
    const afterSchool = clean.slice(clean.indexOf(schoolMatch[1]) + schoolMatch[1].length).trim();
    const majorMatch = afterSchool.match(/([\u4e00-\u9fa5A-Za-z0-9()/\-]+(?:专业|方向|技术|工程|设计|管理|媒体|科学|文学|法学|经济学|教育|数学|统计|传播|计算机|英语|智能|艺术)?(?:本科|硕士|博士)?)/);
    major = (majorMatch?.[1] || "").replace(/^(教育经历|学历)\s*/, "").trim();
  }
  return {
    school: schoolMatch?.[1] || "",
    degree: degreeMatch?.[1] || "",
    major,
    educationStart: dates[0] || "",
    educationEnd: dates[1] || ""
  };
}

function cleanBullet(line) {
  return String(line || "").replace(/^[•·\-\d.、\s]+/, "").trim();
}

function isModuleHeader(line) {
  return MODULE_HEADER_HINT.test(String(line || "").trim());
}

function looksLikeAbilitySummary(line) {
  const text = cleanBullet(line);
  if (!text) return false;
  const hasAbility = ABILITY_HINT.test(text) || TOOL_HINT.test(text) || AI_HINT.test(text) || ENGINEERING_HINT.test(text);
  const hasNarrative = PROJECT_NARRATIVE_HINT.test(text);
  const tokenCount = text.split(/[、,，/| ]+/).filter(Boolean).length;
  return hasAbility && (!hasNarrative || tokenCount >= 5);
}

function classifyAbility(line) {
  const text = cleanBullet(line);
  if (!text) return null;
  if (SKILL_PREFIX_HINT.test(text)) return "skills";
  if (ADVANTAGE_PREFIX_HINT.test(text)) return "advantages";
  if (AWARD_PREFIX_HINT.test(text) || CERT_PREFIX_HINT.test(text) || ACADEMIC_PREFIX_HINT.test(text)) return "other";
  if (TOOL_HINT.test(text)) return "skills";
  if (AI_HINT.test(text) || ENGINEERING_HINT.test(text)) return "advantages";
  if (/(敏感度|学习能力|沟通能力|协作能力|抗压能力|责任心|自驱力|好奇心|逻辑思维|产品思维|业务理解|快速上手)/.test(text)) return "advantages";
  return "other";
}

function detectExpType(line) {
  if (/(自主项目|个人项目|side project)/i.test(line)) return "project";
  if (/项目/.test(line)) return "project";
  if (/实习/.test(line)) return "internship";
  if (/工作|任职|公司/.test(line)) return "work";
  return "project";
}

function isExperienceSectionHeader(line) {
  return /(项目经历|项目经验|项目实践|实习经历|实习经验|工作经历|工作经验|职业经历|项目\/校园经历|项目\/校内经历|校园经历)/.test(String(line || "").trim());
}

function parsePeriodLine(line, currentType) {
  const periodMatch = String(line || "").match(PERIOD_PREFIX_RE);
  if (!periodMatch) return null;
  const period = periodMatch[1].trim();
  const rest = periodMatch[2].trim();
  if (!rest) return null;

  const compactParts = rest.split(/\s{2,}|\t+/).map((x) => x.trim()).filter(Boolean);
  const fallbackParts = rest.split(/\s+/).map((x) => x.trim()).filter(Boolean);
  let parts = compactParts.length >= 2 ? compactParts : fallbackParts;
  if (parts.length < 2) {
    const roleMatch = rest.match(new RegExp(`(.+?)\\s+(${ROLE_TAIL_HINT.source})`, "i"));
    if (roleMatch) parts = [roleMatch[1].trim(), roleMatch[2].trim()];
  }
  if (parts.length < 2) return null;

  if (currentType === "project") {
    return {
      type: currentType,
      period,
      title: parts.slice(0, -1).join(" "),
      role: parts[parts.length - 1],
      description: ""
    };
  }

  return {
    type: currentType,
    period,
    company: parts.slice(0, -1).join(" "),
    role: parts[parts.length - 1],
    description: ""
  };
}

function prettyType(type) {
  if (type === "internship") return "实习经历";
  if (type === "work") return "工作经历";
  return "项目经历";
}

function normalizeExperience(experience) {
  const period = experience.period || "";
  const start = experience.start || normalizeDate((period.match(new RegExp(`(${YEAR_MONTH})`)) || [])[1] || "");
  const endRaw = (period.match(new RegExp(`(?:-|~|至|到)\\s*(${YEAR_MONTH}|至今|present)`, "i")) || [])[1] || "";
  const forcedProject = /(自主项目|个人项目|side project)/i.test(`${experience.title || ""} ${experience.company || ""} ${experience.role || ""} ${experience.description || ""}`);
  const finalType = forcedProject ? "project" : (experience.type || "project");
  return {
    type: finalType,
    typeLabel: prettyType(finalType),
    title: experience.title || "",
    company: experience.company || "",
    role: experience.role || "",
    start,
    end: experience.end || normalizeDate(endRaw),
    description: (experience.description || "").trim()
  };
}

function extractExperiences(text) {
  const lines = text.split(/\n/).map((x) => x.trim()).filter(Boolean);
  const abilities = { skills: [], advantages: [], other: [] };
  const collectAbility = (line) => {
    const text = cleanBullet(line);
    if (!text || isModuleHeader(text)) return;
    const key = classifyAbility(text);
    if (!key) return;
    if (!abilities[key].includes(text)) abilities[key].push(text);
  };
  const shouldTerminateDescription = (line, current) => {
    if (!current) return false;
    if (isModuleHeader(line)) return true;
    const text = cleanBullet(line);
    if (!text) return false;
    const desc = String(current.description || "");
    return desc.length > 380 && looksLikeAbilitySummary(text);
  };
  const pushDedupe = (bucket, current) => {
    if (current && (current.company || current.role || current.description || current.title)) bucket.push(normalizeExperience(current));
    return null;
  };
  const dedupe = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = [item.type, item.title, item.company, item.role, item.start, item.end, item.description].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const parseTimeline = () => {
    const out = [];
    let currentType = "project";
    let inExperienceSection = false;
    let current = null;
    for (const line of lines) {
      if (isModuleHeader(line)) {
        current = pushDedupe(out, current);
        inExperienceSection = false;
        continue;
      }
      if (EDUCATION_HINT.test(line) && !isExperienceSectionHeader(line)) continue;
      if (shouldTerminateDescription(line, current)) {
        current = pushDedupe(out, current);
        collectAbility(line);
        continue;
      }
      if (!current && looksLikeAbilitySummary(line)) {
        collectAbility(line);
        continue;
      }
      if (isExperienceSectionHeader(line)) {
        currentType = detectExpType(line);
        inExperienceSection = true;
        current = pushDedupe(out, current);
        continue;
      }
      if (!inExperienceSection) continue;
      const periodLine = parsePeriodLine(line, currentType);
      if (periodLine) {
        if (EDUCATION_HINT.test(periodLine.title || "") || EDUCATION_HINT.test(periodLine.company || "") || EDUCATION_HINT.test(periodLine.role || "")) continue;
        current = pushDedupe(out, current);
        current = periodLine;
        continue;
      }
      if (/^[•·\-]/.test(line) || current) {
        if (!current) current = { type: currentType, description: "" };
        current.description = (current.description ? `${current.description}\n` : "") + line.replace(/^[•·\-]\s*/, "");
      }
    }
    current = pushDedupe(out, current);
    return out;
  };
  const parseLabeled = () => {
    const out = [];
    let currentType = "project";
    let inExperienceSection = false;
    let current = null;
    for (const line of lines) {
      if (isExperienceSectionHeader(line)) {
        current = pushDedupe(out, current);
        currentType = detectExpType(line);
        inExperienceSection = true;
        continue;
      }
      if (!inExperienceSection) continue;
      if (isModuleHeader(line)) {
        current = pushDedupe(out, current);
        inExperienceSection = false;
        continue;
      }
      const miniHeader = line.match(/^(公司名称|公司|项目名称|项目|职位|岗位|角色|开始时间|起始时间|结束时间|截止时间|起止时间|时间周期|时间|描述|工作内容|项目描述)[:：]\s*(.+)$/);
      if (!miniHeader) continue;
      const keyMap = { "公司名称": "company", "公司": "company", "项目名称": "title", "项目": "title", "职位": "role", "岗位": "role", "角色": "role", "开始时间": "start", "起始时间": "start", "结束时间": "end", "截止时间": "end", "起止时间": "period", "时间周期": "period", "时间": "period", "描述": "description", "工作内容": "description", "项目描述": "description" };
      const key = keyMap[miniHeader[1]];
      const value = /^(开始时间|起始时间|结束时间|截止时间)$/.test(miniHeader[1]) ? normalizeDate(miniHeader[2]) : miniHeader[2].trim();
      if ((key === "company" || key === "title") && current && (current.company || current.title)) current = pushDedupe(out, current);
      if (!current) current = { type: currentType, description: "" };
      current[key] = key === "description" && current.description ? `${current.description}\n${value}` : value;
    }
    current = pushDedupe(out, current);
    return out;
  };
  const looksLikeCompanyLine = (line) => {
    const text = String(line || "").trim();
    if (!text || text.length > 42 || /[:：]/.test(text) || new RegExp(`^${YEAR_MONTH}`).test(text)) return false;
    return /(公司|有限公司|科技|信息|网络|大学|学院|研究院|工作室|集团)$/.test(text) || /（.*?）$/.test(text);
  };
  const looksLikeRoleLine = (line) => {
    const text = String(line || "").trim();
    return !!text && text.length <= 24 && !/[:：]/.test(text) && ROLE_TAIL_HINT.test(text);
  };
  const parseCompanyBlocks = () => {
    const out = [];
    let currentType = "project";
    let inExperienceSection = false;
    let current = null;
    for (const line of lines) {
      if (isExperienceSectionHeader(line)) {
        current = pushDedupe(out, current);
        currentType = detectExpType(line);
        inExperienceSection = true;
        continue;
      }
      if (!inExperienceSection) continue;
      if (isModuleHeader(line)) {
        current = pushDedupe(out, current);
        inExperienceSection = false;
        continue;
      }
      if (parsePeriodLine(line, currentType)) continue;
      if (looksLikeCompanyLine(line)) {
        current = pushDedupe(out, current);
        current = { type: currentType, company: line, description: "" };
        continue;
      }
      if (current && !current.role && looksLikeRoleLine(line)) {
        current.role = line;
        continue;
      }
      if (current) {
        const clean = line.replace(/^[•·\-]\s*/, "");
        current.description = current.description ? `${current.description}\n${clean}` : clean;
      }
    }
    current = pushDedupe(out, current);
    return out;
  };
  const experiences = dedupe([...parseLabeled(), ...parseTimeline(), ...parseCompanyBlocks()]);
  return { experiences, abilities };
}

function extractEducation(text) {
  const edu = {
    school: pickByRegex(text, /学校[:：]\s*([^\n]+)/),
    college: pickByRegex(text, /学院[:：]\s*([^\n]+)/),
    major: pickByRegex(text, /(?:专业|详细专业)[:：]\s*([^\n]+)/),
    degree: pickByRegex(text, /学历[:：]\s*([^\n]+)/),
    educationStart: normalizeDate(pickByRegex(text, /入学时间[:：]\s*([^\n]+)/)),
    educationEnd: normalizeDate(pickByRegex(text, /毕业时间[:：]\s*([^\n]+)/)),
    mainCourses: pickByRegex(text, /主修课程[:：]\s*([^\n]+)/)
  };

  const inline = parseInlineEducation(text);
  if (!edu.school && inline?.school) edu.school = inline.school;
  if (!edu.major && inline?.major) edu.major = inline.major;
  if (!edu.degree && inline?.degree) edu.degree = inline.degree;
  if (!edu.educationStart && inline?.educationStart) edu.educationStart = inline.educationStart;
  if (!edu.educationEnd && inline?.educationEnd) edu.educationEnd = inline.educationEnd;

  return edu;
}

export function parseResumeText(rawText) {
  const text = rawText.replace(/\r/g, "").trim();
  const blocks = splitBlocks(text);

  const profile = {
    name: pickByRegex(text, /姓名[:：]\s*([^\n]+)/),
    gender: pickByRegex(text, /性别[:：]\s*([^\n]+)/),
    birthday: normalizeDate(pickByRegex(text, /(?:出生日期|生日)[:：]\s*([^\n]+)/)),
    city: pickByRegex(text, /(?:所在城市|现居地)[:：]\s*([^\n]+)/),
    idType: pickByRegex(text, /证件类型[:：]\s*([^\n]+)/) || "身份证",
    idNumber: pickByRegex(text, /(?:证件号码|身份证号)[:：]\s*([^\n]+)/),
    phone: pickByRegex(text, /(?:手机号|电话|手机)[:：]?\s*(1\d{10})/) || pickByRegex(text, /(1\d{10})/),
    email: pickByRegex(text, /(?:邮箱|Email|E-mail)[:：]?\s*([^\s\n]+)/i),
    wechat: pickByRegex(text, /(?:微信号|微信)[:：]\s*([^\n]+)/),
    emergencyContact: pickByRegex(text, /紧急联系人[:：]\s*([^\n]+)/),
    emergencyPhone: pickByRegex(text, /紧急联系方式[:：]\s*([^\n]+)/),
    skills: "",
    advantages: "",
    otherInfo: ""
  };

  const educationBlock = blocks.find((x) => /(教育经历|学历|学校|入学时间|毕业时间)/.test(x)) || text;
  const education = extractEducation(educationBlock);

  const expStart = text.search(/(项目经历|项目经验|项目实践|项目\/校园经历|工作经历|工作经验|实习经历|实习经验|校园经历)/);
  const expSlice = expStart >= 0 ? text.slice(expStart) : text;
  const extracted = extractExperiences(expSlice);
  const experiences = extracted.experiences;
  const unique = (arr) => [...new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))];
  const mergeTags = (base, arr) => unique([...(String(base || "").split(/[,，/|\n]+/)), ...arr]).join(" / ").trim();
  const mergeBullets = (base, arr) => unique([...(String(base || "").split(/\n+/)), ...arr]).join("\n").trim();
  profile.skills = mergeTags(profile.skills, extracted.abilities.skills);
  profile.advantages = mergeBullets(profile.advantages, extracted.abilities.advantages);
  profile.otherInfo = mergeBullets(profile.otherInfo, extracted.abilities.other);
  Object.assign(profile, extractModuleProfile(text));

  return {
    profile: { ...profile, ...education },
    experiences,
    rawText: text
  };
}

export function flattenForFill(parsed) {
  const result = JD_FIELD_SCHEMA.map((x) => ({
    key: x.key,
    label: x.label,
    value: parsed.profile?.[x.key] || ""
  }));

  const grouped = { project: 0, internship: 0, work: 0 };
  (parsed.experiences || []).forEach((experience) => {
    const type = experience.type || "project";
    grouped[type] += 1;
    const i = grouped[type];
    const keyPrefix = `${type}_${i}`;
    const blockLabel = `${experience.typeLabel}${i}`;
    const projectChildren = [
      { key: `${keyPrefix}_title`, label: "项目名称", value: experience.title || experience.company || "" },
      { key: `${keyPrefix}_role`, label: "角色", value: experience.role || "" },
      { key: `${keyPrefix}_start`, label: "开始时间", value: experience.start || "" },
      { key: `${keyPrefix}_end`, label: "结束时间", value: experience.end || "" },
      { key: `${keyPrefix}_description`, label: "描述", value: experience.description || "" }
    ];
    const internshipChildren = [
      { key: `${keyPrefix}_company`, label: "公司名称", value: experience.company || "" },
      { key: `${keyPrefix}_role`, label: "职位", value: experience.role || "" },
      { key: `${keyPrefix}_start`, label: "开始时间", value: experience.start || "" },
      { key: `${keyPrefix}_end`, label: "结束时间", value: experience.end || "" },
      { key: `${keyPrefix}_description`, label: "描述", value: experience.description || "" }
    ];
    const workChildren = [
      { key: `${keyPrefix}_company`, label: "公司名称", value: experience.company || "" },
      { key: `${keyPrefix}_role`, label: "职位", value: experience.role || "" },
      { key: `${keyPrefix}_start`, label: "开始时间", value: experience.start || "" },
      { key: `${keyPrefix}_end`, label: "结束时间", value: experience.end || "" },
      { key: `${keyPrefix}_description`, label: "描述", value: experience.description || "" }
    ];
    result.push({
      key: `${keyPrefix}_block`,
      label: blockLabel,
      group: true,
      children: type === "project" ? projectChildren : type === "internship" ? internshipChildren : workChildren
    });
  });

  return result.filter((x) => (x.group ? x.children?.some((child) => child.value) : x.value));
}
