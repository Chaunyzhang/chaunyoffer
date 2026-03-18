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
  { key: "educationEnd", label: "毕业时间" }
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

function detectExpType(line) {
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
  return {
    type: experience.type || "project",
    typeLabel: prettyType(experience.type || "project"),
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
  let currentType = "project";
  let current = null;

  for (const line of lines) {
    if (/(项目经历|实习经历|工作经历)/.test(line)) {
      currentType = detectExpType(line);
      if (current && (current.company || current.role || current.description || current.title)) {
        experiences.push(normalizeExperience(current));
      }
      current = null;
      continue;
    }

    const titleMatch = line.match(/^(\d{4}[.-]\d{1,2}.*?)(?:\s{2,}|\t+)(.+?)(?:\s{2,}|\t+)(.+)$/);
    if (titleMatch) {
      if (current && (current.company || current.role || current.description || current.title)) {
        experiences.push(normalizeExperience(current));
      }
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

  if (current && (current.company || current.role || current.description || current.title)) {
    experiences.push(normalizeExperience(current));
  }

  return experiences;
}

function extractEducation(text) {
  const edu = {
    school: pickByRegex(text, /学校[:：]\s*([^\n]+)/),
    college: pickByRegex(text, /学院[:：]\s*([^\n]+)/),
    major: pickByRegex(text, /(?:专业|详细专业)[:：]\s*([^\n]+)/),
    degree: pickByRegex(text, /学历[:：]\s*([^\n]+)/),
    educationStart: normalizeDate(pickByRegex(text, /(?:入学时间|开始时间)[:：]\s*([^\n]+)/)),
    educationEnd: normalizeDate(pickByRegex(text, /(?:毕业时间|结束时间)[:：]\s*([^\n]+)/))
  };

  const dateMatches = [...text.matchAll(/(20\d{2}[.-]\d{1,2}(?:[.-]\d{1,2})?)/g)].map((m) => normalizeDate(m[1]));
  if (!edu.educationStart && dateMatches[0]) edu.educationStart = dateMatches[0];
  if (!edu.educationEnd && dateMatches[1]) edu.educationEnd = dateMatches[1];

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
    emergencyPhone: pickByRegex(text, /紧急联系方式[:：]\s*([^\n]+)/)
  };

  const educationBlock = blocks.find((x) => /(教育经历|学历|学校|入学时间|毕业时间)/.test(x)) || text;
  const education = extractEducation(educationBlock);

  const expStart = text.search(/(项目经历|工作经历|实习经历)/);
  const expSlice = expStart >= 0 ? text.slice(expStart) : text;
  const experiences = extractExperiences(expSlice);

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
    result.push({
      key: `${keyPrefix}_block`,
      label: blockLabel,
      group: true,
      children: [
        { key: `${keyPrefix}_title`, label: "项目名称", value: experience.title || "" },
        { key: `${keyPrefix}_company`, label: "公司名称", value: experience.company || "" },
        { key: `${keyPrefix}_role`, label: "职位", value: experience.role || "" },
        { key: `${keyPrefix}_start`, label: "开始时间", value: experience.start || "" },
        { key: `${keyPrefix}_end`, label: "结束时间", value: experience.end || "" },
        { key: `${keyPrefix}_description`, label: "描述", value: experience.description || "" }
      ]
    });
  });

  return result.filter((x) => (x.group ? x.children?.some((child) => child.value) : x.value));
}
