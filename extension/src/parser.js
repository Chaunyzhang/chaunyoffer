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
  const m = compact.match(/(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!m) return value.trim();
  const y = m[1];
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

const EDUCATION_HINT = /(教育经历|学校|学院|专业|学历|主修课程|入学时间|毕业时间|本科|硕士|博士|专科|研究生)/;
const MODULE_HEADER_HINT = /^(技能|能力|优势|总结|其他|技能总结|能力描述|全局经验|技能与工具|AI能力|工程能力|技术栈|核心能力|个人优势|其他信息|专业技能)(?:[:：]?\s*)$/i;
const ABILITY_HINT = /(熟练|精通|熟悉|掌握|擅长|具备|能够|善于|方法论|工具链|技术栈|prompt engineering|rag|multi-agent|agent|workflow|aigc|llm|模型|能力)/i;
const PROJECT_NARRATIVE_HINT = /(负责|实现|优化|上线|提升|降低|完成|重构|设计|搭建|开发|测试|落地|推动|迭代|产出|转化|准确率|时延|用户|业务|场景|需求|复盘)/;
const TOOL_HINT = /(cursor|dify|coze|supabase|vercel|n8n|langchain|lark|notion|mysql|redis|docker|k8s|python|typescript|react|next\.?js|node\.?js)/i;
const AI_HINT = /(ai agent|agent|multi-agent|prompt engineering|rag|llm|midjourney|stable diffusion|flux|comfyui|siliconflow|gpt|claude|qwen|deepseek)/i;
const ENGINEERING_HINT = /(架构|工程化|性能|可观测|自动化|部署|联调|稳定性|重构|测试|监控|pipeline|workflow|serverless|ci\/cd|debug)/i;

function parseInlineEducation(line) {
  const clean = String(line || "").replace(/\s+/g, " ").trim();
  if (!clean || !EDUCATION_HINT.test(clean)) return null;
  const dates = [...clean.matchAll(/(20\d{2}[./-]\d{1,2}(?:[./-]\d{1,2})?)/g)].map((m) => normalizeDate(m[1]));
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
  if (TOOL_HINT.test(text)) return "skills";
  if (AI_HINT.test(text) || ENGINEERING_HINT.test(text)) return "advantages";
  return "other";
}

function detectExpType(line) {
  if (/(自主项目|个人项目|side project)/i.test(line)) return "project";
  if (/项目/.test(line)) return "project";
  if (/实习/.test(line)) return "internship";
  if (/工作|任职|公司/.test(line)) return "work";
  return "project";
}

function prettyType(type) {
  if (type === "internship") return "实习经历";
  if (type === "work") return "工作经历";
  return "项目经历";
}

function normalizeExperience(experience) {
  const period = experience.period || "";
  const start = experience.start || normalizeDate((period.match(/(\d{4}[.-]\d{1,2})/) || [])[1] || "");
  const endRaw = (period.match(/-(\d{4}[.-]\d{1,2}|至今|present)/i) || [])[1] || "";
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
  const experiences = [];
  const abilities = { skills: [], advantages: [], other: [] };
  let currentType = "project";
  let current = null;
  const pushCurrent = () => {
    if (current && (current.company || current.role || current.description || current.title)) {
      experiences.push(normalizeExperience(current));
    }
    current = null;
  };
  const collectAbility = (line) => {
    const text = cleanBullet(line);
    if (!text || isModuleHeader(text)) return;
    const key = classifyAbility(text);
    if (!key) return;
    if (!abilities[key].includes(text)) abilities[key].push(text);
  };
  const shouldTerminateDescription = (line) => {
    if (!current) return false;
    if (isModuleHeader(line)) return true;
    const text = cleanBullet(line);
    if (!text) return false;
    const desc = String(current.description || "");
    return desc.length > 380 && looksLikeAbilitySummary(text);
  };

  for (const line of lines) {
    if (isModuleHeader(line)) {
      pushCurrent();
      continue;
    }
    if (EDUCATION_HINT.test(line)) continue;
    if (shouldTerminateDescription(line)) {
      pushCurrent();
      collectAbility(line);
      continue;
    }
    if (!current && looksLikeAbilitySummary(line)) {
      collectAbility(line);
      continue;
    }
    if (/(项目经历|实习经历|工作经历)/.test(line)) {
      currentType = detectExpType(line);
      pushCurrent();
      continue;
    }

    const titleMatch = line.match(/^(\d{4}[.-]\d{1,2}.*?)(?:\s{2,}|\t+)(.+?)(?:\s{2,}|\t+)(.+)$/);
    if (titleMatch) {
      if (EDUCATION_HINT.test(titleMatch[2]) || EDUCATION_HINT.test(titleMatch[3])) continue;
      pushCurrent();
      current = {
        type: currentType,
        period: titleMatch[1].trim(),
        company: titleMatch[2].trim(),
        role: titleMatch[3].trim(),
        description: ""
      };
      continue;
    }

    const miniHeader = line.match(/^(公司名称|项目名称|职位|角色|开始时间|结束时间|描述)[:：]\s*(.+)$/);
    if (miniHeader) {
      if (!current) current = { type: currentType, description: "" };
      const keyMap = {
        "公司名称": "company",
        "项目名称": "title",
        "职位": "role",
        "角色": "role",
        "开始时间": "start",
        "结束时间": "end",
        "描述": "description"
      };
      const key = keyMap[miniHeader[1]];
      const value = /时间/.test(miniHeader[1]) ? normalizeDate(miniHeader[2]) : miniHeader[2].trim();
      if (key === "description" && current.description) {
        current.description += "\n" + value;
      } else {
        current[key] = value;
      }
      continue;
    }

    if (/^[•·\-]/.test(line) || current) {
      if (!current) current = { type: currentType, description: "" };
      current.description = (current.description ? `${current.description}\n` : "") + line.replace(/^[•·\-]\s*/, "");
    }
  }

  pushCurrent();

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

  const expStart = text.search(/(项目经历|工作经历|实习经历)/);
  const expSlice = expStart >= 0 ? text.slice(expStart) : text;
  const extracted = extractExperiences(expSlice);
  const experiences = extracted.experiences;
  const unique = (arr) => [...new Set((arr || []).map((x) => String(x || "").trim()).filter(Boolean))];
  const mergeTags = (base, arr) => unique([...(String(base || "").split(/[,，/|\n]+/)), ...arr]).join(" / ").trim();
  const mergeBullets = (base, arr) => unique([...(String(base || "").split(/\n+/)), ...arr]).join("\n").trim();
  profile.skills = mergeTags(profile.skills, extracted.abilities.skills);
  profile.advantages = mergeBullets(profile.advantages, extracted.abilities.advantages);
  profile.otherInfo = mergeBullets(profile.otherInfo, extracted.abilities.other);

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
