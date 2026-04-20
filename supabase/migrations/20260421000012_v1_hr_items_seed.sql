-- v1 Task 4a: Seed 26 HR compliance items from batch2.md (Phase 1-4)
-- 3.1 and 4.1 are Phase sign-offs (readii-completed, not customer-uploaded).

INSERT INTO hr_compliance_items (item_code, phase_number, item_number, title, description, compliance_basis, evidence_type, is_mandatory, is_signoff)
VALUES
  -- Phase 1: 现有员工合规审计（8 项）
  ('1_1', 1, '1.1', '雇佣合同签署并留档',
   $c$双方签字的雇佣合同，必须包含：雇主/雇员全名及地址、开始日期、职位名称及描述（须与 CoS 完全一致）、工作地点、薪资（≥£41,700/年或 going rate 取高值）及支付频率、工作时间、年假权益（法定 28 天）、试用期（如有）、终止通知期、养老金信息、纪律和申诉程序。建议中英双语。$c$,
   'Employment Rights Act 1996 s.1',
   '双方签字的雇佣合同 PDF',
   true, false),

  ('1_2', 1, '1.2', 'Right to Work 核查完成并留档',
   $c$入职前核查 Graduate Visa 或其他合法签证原件（护照+Vignette 或 BRP），拍摄清晰彩色照片存档（信息页+签证页或 BRP 两面）。在核查记录表注明核查日期、核查人、核查类型。eVisa 用 UKVI Employer Checking Service 核验并截图。雇佣结束后至少保留 2 年。违反最高罚款 £45,000。$c$,
   'Immigration Act 2014',
   'RTW 核查记录表 + 护照/签证/BRP 彩色照片',
   true, false),

  ('1_3', 1, '1.3', 'P45/P46 新员工信息存档',
   $c$如有上一份英国工作请雇员提供 P45（含离职日期、累计收入、已缴税款），转交会计事务所。无 P45 则填 P46/HMRC Starter Checklist（全名、NI Number、地址、是否主要工作）。如无 NI Number 且未填 P45，会用 Emergency Tax Code。$c$,
   'Income Tax (PAYE) Regulations 2003',
   'P45 扫描件或 P46 填写记录',
   true, false),

  ('1_4', 1, '1.4', 'Tax Code 和 NI Number 记录',
   $c$Tax Code 由会计所依 P45/P46 设置（2025-26 标准 1257L）。NI Number 格式两字母+六数字+一字母。境外雇员入境后须向 HMRC 申请 NI Number。将 Tax Code 和 NI Number 记录在员工档案。$c$,
   'HMRC PAYE Obligations',
   'Tax Code 通知记录 + NI Number 确认',
   true, false),

  ('1_5', 1, '1.5', 'Pension Auto-Enrollment 状态确认',
   $c$符合条件（22 岁至国家养老金年龄、在英国工作、年收入 >£10,000）的雇员入职后 6 周内必须自动加入工作场所养老金（推荐 NEST）。雇主供款 ≥3%，雇员 ≥5%。雇员可 Opt-Out 但不能被强制。$c$,
   'Pensions Act 2008',
   '养老金加入确认书或 Opt-Out 通知',
   true, false),

  ('1_6', 1, '1.6', 'Holiday Entitlement 计算正确',
   $c$全职法定年假 28 天（含 8 个法定节假日）。试用期内按比例累积，年假不得用金钱代替（离职时须结算未使用假期）。兼职按工作天数比例计算。合同年假条款必须 ≥28 天法定最低。$c$,
   'Working Time Regulations 1998',
   '合同中假期条款 + 年假管理记录表',
   true, false),

  ('1_7', 1, '1.7', 'Working Time Opt-Out（超 48 小时/周）',
   $c$英国工人每周工作平均不得超过 48 小时（17 周滚动平均）。如业务需要经常超时，雇员可自愿签 Opt-Out 协议（可随时撤回，给予 7 天书面通知）。不得将 Opt-Out 作为入职条件。$c$,
   'Working Time Regulations 1998 Regulation 4',
   '签署的 Opt-Out 协议或"不适用"确认',
   true, false),

  ('1_8', 1, '1.8', 'Data Protection Notice 已发放',
   $c$雇主作为员工数据 Data Controller 必须告知：Data Controller 联系方式、处理目的和法律依据、数据保留期限、员工数据权利（查阅/纠错/删除）、是否向第三方（会计所、HMRC）传输。随合同一同发放或作合同章节，雇员签字确认。$c$,
   'UK GDPR Article 13/14',
   '雇员签字确认的《员工数据保护通知》',
   true, false),

  -- Phase 2: 雇佣合同和政策文件（4 项）
  ('2_1', 2, '2.1', '雇佣合同（完整版）',
   $c$确认 1.1 完整版合同已完成，含所有法定条款及公司特定条款。额外核查：竞业禁止条款（如有，范围合理可执行）、知识产权归属（雇员在职期间 IP 归公司）、保密协议（NDA）是否独立签署。$c$,
   'Employment Rights Act 1996',
   '最终完整版雇佣合同（含所有附件）',
   true, false),

  ('2_2', 2, '2.2', 'Disciplinary and Grievance Policy',
   $c$书面纪律与申诉政策，须含：纪律程序（违规 vs 严重违规定义、调查程序、书面警告流程、解雇决定程序、上诉权）、申诉程序（正式提出方式、初步讨论、书面申诉处理、通知方式、上诉权）。小公司（1-5 人）可用简化版。$c$,
   'Employment Act 2002; ACAS Code of Practice',
   '员工签字确认的《纪律与申诉政策》',
   true, false),

  ('2_3', 2, '2.3', 'Health & Safety Policy',
   $c$超过 5 名员工必须有书面 H&S 政策，含：雇主 H&S 总体承诺声明、职责分工、主要风险评估（办公环境通常低风险）、火灾疏散程序、事故/险情报告程序、员工 H&S 义务。应含 DSE 管理条款。$c$,
   'Health and Safety at Work Act 1974 s.2(3)',
   '书面《Health & Safety Policy》（雇主签字）',
   true, false),

  ('2_4', 2, '2.4', 'Code of Conduct',
   $c$员工行为准则，含：职业行为标准、保密义务、利益冲突申报、社交媒体使用、电子设备使用、反骚扰/歧视零容忍、举报机制（Whistleblowing）。雇员签字确认已阅读并同意遵守。$c$,
   '雇主最佳实践',
   '员工签字的《员工行为准则》',
   true, false),

  -- Phase 3: Payroll/Pension/HMRC/ICO（6 项，3.1 是 Phase 1 sign-off）
  ('3_1', 3, '3.1', 'Phase 1 Sign Off',
   $c$Readii 合规团队（或负责人）正式确认 Phase 1 所有 8 项已完成，证明文件齐备，可进入 Phase 2。触发动作：生成 Phase 1 完成证明，更新 Journey 进度，通知内部团队 Phase 2 待办。$c$,
   'Readii 内部流程',
   'Readii 合规团队签字的 Phase 1 完成确认单',
   true, true),

  ('3_2', 3, '3.2', 'Payroll 系统运行正常',
   $c$每次发工资时须向 HMRC 提交 Full Payment Submission（FPS），最晚不超过付薪日。延迟提交罚款 £100-400/月。确认会计所已提交首份 FPS，HMRC 已收到（Business Tax Account 查询），薪资已按时发入雇员账户。每次发薪须提供工资单（含 Gross/扣除/Net）。$c$,
   'Income Tax (PAYE) Regulations 2003; RTI',
   '首份 RTI 申报提交确认（HMRC Business Tax Account 截图）',
   true, false),

  ('3_3', 3, '3.3', 'Pension Scheme 和通知信已发放',
   $c$两类通知必须发放：①Auto-Enrolment 通知（评估资格后 6 周内，说明已加入、供款比例、Opt-Out 权利）；②不符合条件通知。首次 Auto-Enrolment 后 5 个月内须向 TPR 声明合规（Declaration of Compliance）。$c$,
   'Pensions Act 2008; TPR',
   '养老金加入通知信副本 + TPR 声明合规确认',
   true, false),

  ('3_4', 3, '3.4', 'Data Protection Policy（公司级）',
   $c$与 1.8（员工通知）不同，此为公司整体如何处理所有数据（含客户数据）。必须覆盖：收集的数据类型、法律依据、数据安全措施、保留和删除政策、数据泄露响应程序（72 小时内向 ICO 报告）、员工数据访问权限管理。董事签字。$c$,
   'UK GDPR; Data Protection Act 2018',
   '书面《公司数据保护政策》（董事签字）',
   true, false),

  ('3_5', 3, '3.5', 'ICO Registration 完成',
   $c$几乎所有商业公司需向 ICO 注册。ico.org.uk/registration 在线注册，Tier 1（≤10 员工，营业额 ≤£632K）£40/年，Tier 2 £60/年。注册内容：公司名称、地址、处理的数据类型、处理目的。ICO 颁发注册证书（含注册号）。$c$,
   'Data Protection Act 2018 s.108',
   'ICO 注册证书（含注册号）',
   true, false),

  ('3_6', 3, '3.6', '相关 HMRC 注册完成',
   $c$Corporation Tax（UTR，公司注册后 3 个月内，通知信 4-8 周内邮寄到注册地址）；PAYE Scheme（雇员入职前必须激活，参考号 XXX/XXXXXXX）；VAT 注册（年营业额 ≥£90,000 须注册，可提前自愿）；CIS（建筑行业用分包商须注册）。$c$,
   'HMRC Tax Obligations',
   '所有适用项目的 HMRC 注册确认文件集合',
   true, false),

  -- Phase 4: 招聘和入职流程（8 项，4.1 是 Phase 2 sign-off）
  ('4_1', 4, '4.1', 'Phase 2 Sign Off',
   $c$Readii 合规团队正式确认 Phase 2 全部 4 项完成。$c$,
   'Readii 内部流程',
   'Readii 合规团队签字的 Phase 2 完成确认单',
   true, true),

  ('4_2', 4, '4.2', 'Recruitment Policy & Process',
   $c$公司正式招聘流程文件，含：内部审批流程、JD 制定程序（与 CoS 申请 JD 须一致）、招聘渠道、筛选和面试流程、录用决定程序、Offer Letter 要求、背景调查触发条件。Sponsor Licence 须证明岗位 genuine 需求，建议记录招聘过程。$c$,
   'Sponsor Licence Compliance',
   '书面《招聘政策》文件',
   true, false),

  ('4_3', 4, '4.3', 'Equal Opportunities Policy',
   $c$禁止基于 9 项保护特征（年龄/残疾/性别重置/婚姻/怀孕育儿/种族/宗教/性别/性取向）歧视。政策须含：平等就业承诺声明、适用范围（招聘/培训/晋升/薪资）、歧视举报程序、违反纪律处理。招聘广告和面试不得涉及保护特征。$c$,
   'Equality Act 2010',
   '书面《平等就业机会政策》',
   true, false),

  ('4_4', 4, '4.4', 'Background Checks Process',
   $c$标准背景调查：身份核验（由 RTW 涵盖）、就业历史核实（Reference Check）、学历证书核验、专业资质核验、DBS 核查（教育/医疗/社会服务类必须）。流程文件须含：哪些岗位需何种调查、何时进行（通常在有条件 Offer 后）、不通过的处理、数据保护。$c$,
   'Sponsor Licence Best Practice',
   '书面《背景调查流程》文件',
   true, false),

  ('4_5', 4, '4.5', 'Right to Work Checks（入职前专项核查）',
   $c$与 1.2 配合，确认入职前（不是入职后）的 RTW 核查已成为标准流程。核查必须在雇员实际开始工作前完成。建立签证到期前 2-3 个月提醒系统，未续签须停止雇佣（否则构成违法雇佣）。$c$,
   'Immigration Act 2014',
   '入职前 Right to Work 核查记录（格式同 1.2）',
   true, false),

  ('4_6', 4, '4.6', 'Payroll Starter Form',
   $c$HMRC Starter Checklist（替代旧 P46）：个人信息、NI Number、Statement A/B/C（A=第一份工作免税额全额适用；B=有其他工作按基础税率；C=其他工作已用全部免税额按高税率）、学生贷款还款、养老金信息。会计所据此设置 Tax Code。$c$,
   'HMRC PAYE Regulations',
   '雇员签署的 HMRC Starter Checklist',
   true, false),

  ('4_7', 4, '4.7', 'DSE Assessment',
   $c$适用"Habitual User"（每天使用显示屏 >1 小时）。评估：显示屏/键盘/鼠标/桌子/椅子/工作环境/软件/工作模式。雇主须提供视力检查（雇员要求时）和适当培训。操作：雇员自评问卷（Readii 提供模板），发现问题安排专业评估。$c$,
   'Health and Safety (DSE) Regulations 1992',
   '完成的 DSE 自评问卷（雇员签字）',
   true, false),

  ('4_8', 4, '4.8', 'Training 记录',
   $c$必须记录：入职培训（第一周）、H&S 基础（入职+定期）、GDPR 数据保护（入职+年度）、岗位专业技能（持续）、软件/系统使用（入职）。每次须记录：名称/内容/日期/时长/形式/参加人员/双方签字完成确认。sponsored worker 培训记录是 genuine employment 证明之一。$c$,
   '雇主最佳实践',
   '员工培训记录表（含签到/完成确认）',
   true, false)
ON CONFLICT (item_code) DO UPDATE SET
  phase_number = EXCLUDED.phase_number,
  item_number = EXCLUDED.item_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  compliance_basis = EXCLUDED.compliance_basis,
  evidence_type = EXCLUDED.evidence_type,
  is_mandatory = EXCLUDED.is_mandatory,
  is_signoff = EXCLUDED.is_signoff;
