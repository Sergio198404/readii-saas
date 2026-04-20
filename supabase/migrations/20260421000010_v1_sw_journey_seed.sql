-- v1 Task 4: Seed 24 stages + 13 variants for sw_self_sponsored template.
-- Source: docs/journey_content/readii_sw_journey_content_v1.md (Part 2).
-- Idempotent: uses ON CONFLICT on (template_id, stage_number) and (stage_id, variant_code).

DO $seed$
DECLARE
  tpl_id UUID;
  s1 UUID; s2 UUID; s3 UUID; s4 UUID; s5 UUID; s6 UUID; s7 UUID; s8 UUID;
  s9 UUID; s10 UUID; s11 UUID; s12 UUID; s13 UUID; s14 UUID; s15 UUID; s16 UUID;
  s17 UUID; s18 UUID; s19 UUID; s20 UUID; s21 UUID; s22 UUID; s23 UUID; s24 UUID;
BEGIN
  SELECT id INTO tpl_id FROM journey_templates
    WHERE service_type = 'sw_self_sponsored' LIMIT 1;
  IF tpl_id IS NULL THEN
    RAISE EXCEPTION 'journey_templates row for sw_self_sponsored not found';
  END IF;

  -- ═══ Stage 1 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku)
  VALUES (tpl_id, 1, 'stage_01', '客户接洽与信息收集', 'Onboarding & Discovery', 'always',
    $c$这是整个 12-14 个月流程的起点。这一步建立了你和 Readii 之间对目标的共同理解，并提前识别所有可能拖延进度的卡点——英语成绩不够、体检窗口计算错误、AO 资格不符合，任何一项如果到后期才发现，都可能浪费数月时间和数千英镑。$c$,
    $c$- 签署服务协议并完成首付款
- 填写 Readii 提供的 10 题客户画像问卷（约 15 分钟）
- 提供雇员基本信息：国籍、英语背景、过往居住国家、拟任岗位方向
- 确认 AO 候选人是否满足"永久居英且无犯罪记录"要求
- 确认启动资金规模$c$,
    $c$- 整理客户画像，基于问卷生成定制 Journey 时间线
- 识别所有需要并行启动的前置事项（英语、体检、无犯罪等）
- 分配专属客户经理和合规顾问
- 在 Readii 工作台开通客户账号，完成 Case File 建档
- 制定 24 周完整时间表，标注每个关键节点$c$,
    7, ARRAY['签署完成的服务协议', '客户画像档案', '定制 Journey 时间线', '前置卡点识别清单', '专属客户经理联系方式'], false)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku
  RETURNING id INTO s1;

  -- ═══ Stage 2 (has variants 2A-2E) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 2, 'stage_02', '雇员英语准备', 'English Requirement', 'always',
    $c$所有 Skilled Worker 申请人必须满足 CEFR B2 英语水平要求（听说读写四项均达标）。系统会根据 Q4 问卷结果自动匹配 5 个变体之一（英国学历豁免 / 国籍豁免 / Ecctis 认证 / 已有有效成绩 / 需考试），每条路径的时间和动作截然不同。此阶段需与阶段 0 并行启动，不能等到签约后再开始。$c$,
    $c$按所匹配的变体执行对应动作（见变体内容）。$c$,
    $c$根据 Q4 分流，提供对应变体的操作指引和核验服务。$c$,
    14, ARRAY['满足 B2 要求的英语证明（豁免证明 / Ecctis 代码 / SELT 成绩）'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s2;

  -- ═══ Stage 3 (conditional) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 3, 'stage_03', '无犯罪记录证明', 'Criminal Record Certificate', 'conditional',
    $c$从英国境外申请（路径 B）且从事特定岗位（教育、医疗、社会服务等约 47 类）的工签申请人，UKVI 强制要求提供所有曾居住超过 12 个月国家的无犯罪记录证明。每份证明必须在签证递交前 6 个月内签发。部分国家（印度、尼日利亚等）的申请处理时间可能长达数月，这个阶段往往是整个工签流程中最漫长、最不可控的关键路径。$c$,
    $c$1. 确认岗位是否在 UKVI 要求清单内（由 Readii 确认）
2. 整理过去 10 年曾居住满 12 个月的所有国家
3. 分别向各国警察/公安机关申请无犯罪证明（中国大陆约 5-15 工作日，英国 ACRO 约 2-10 天）
4. 确保证明在工签递交前 6 个月内签发
5. 非英文证明提供经认证翻译$c$,
    $c$- 确认 SOC Code 是否触发无犯罪要求
- 基于 Q6 生成各国申请待办清单
- 提供各国申请链接、费用、预计时间
- 追踪每份证明申请状态，设置 6 个月有效期警报
- 必要时推荐认证翻译服务$c$,
    60, ARRAY['所有涉及国家的有效无犯罪记录证明（附英文认证翻译）'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s3;

  -- ═══ Stage 4 (has variants 4A/4B) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 4, 'stage_04', '公司结构确认', 'Company Structure', 'always',
    $c$公司结构是 Sponsor Licence 和工签申请的基础框架，系统根据 Q8 问卷自动匹配变体（投资人 100% 持股 / 投资人+雇员共同持股）。雇员持股会影响 UKVI 对 genuine employment 的审查逻辑，比例超过 10% 时合规风险显著上升，需合规团队确认方案。$c$,
    $c$按匹配变体执行。投资人提供护照+英国地址证明；AO 候选人提供同等材料；确认公司名称、业务方向、注册地点。$c$,
    $c$Companies House 查重、SIC Code 推荐、AO 资格核验、《英国公司注册信息表》模板提供。$c$,
    14, ARRAY['确认的公司名称、注册地、SIC Code、AO 人选、身份证明材料'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s4;

  -- ═══ Stage 5 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence, sku_self_serve_content)
  VALUES (tpl_id, 5, 'stage_05', '英国公司注册', 'Company Incorporation', 'always',
    $c$公司注册证书（Certificate of Incorporation）和注册号（CRN）是后续一切事务的证件基础——没有 CRN，无法开银行账户、无法注册税务、也无法申请 Sponsor Licence。$c$,
    $c$- 确认公司名称无异议，授权会计事务所代为注册
- 签署 Memorandum & Articles of Association（公司章程）$c$,
    $c$- 协调推荐的会计事务所完成 Companies House 在线注册
- 确保 AO 在 Companies House 的官方登记（Director 或 Company Secretary）
- 安排初期注册地址服务（初期使用虚拟地址即可）
- 收到 Certificate of Incorporation 后存档至文档中心
- 更新 Journey 进度，触发下一阶段启动通知$c$,
    35, ARRAY['Certificate of Incorporation', '公司注册号 CRN', 'AO 在 Companies House 的登记确认'],
    true, '会员直采（参考价 £440，Readii 不加价）', 44000,
    $c$会员可直接委托合作会计事务所完成 Companies House 注册。参考价 £440（含官方注册费 £79.99 + 1 年收信地址）。Readii 不加价，仅提供转介和进度协调。$c$)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label, sku_price_pence = EXCLUDED.sku_price_pence,
    sku_self_serve_content = EXCLUDED.sku_self_serve_content
  RETURNING id INTO s5;

  -- ═══ Stage 6 (has variants 6A/6B) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 6, 'stage_06', '银行开户', 'Business Bank Account', 'always',
    $c$高街银行的公司账户在 Sponsor Licence 申请中被 UKVI 视为最强的"公司真实经营"证明。系统按 Director 在英国的状态匹配变体（境内持合法签证 / 境外或无签证）。必须与阶段 5 同步启动——若开户延误超过 6 周，整条时间线将全面推迟。$c$,
    $c$按匹配变体执行（见变体内容）。准备 CRN、护照、地址证明、BP 概要、资金来源说明。$c$,
    $c$推荐银行顺序、BP 概要撰写指引、开户进度跟踪；超过 4 周未成功时升级处理。$c$,
    35, ARRAY['公司银行账户（Sort Code + Account Number）'],
    true, '会员直采（参考价 £240/账户，Readii 不加价）', 24000)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label, sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s6;

  -- ═══ Stage 7 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 7, 'stage_07', '税务注册', 'Tax Registration', 'always',
    $c$Corporation Tax UTR（企业纳税号）和 PAYE Scheme（薪资申报体系）是 Appendix A 核心证明文件。PAYE 必须在雇员入职前激活，且依赖银行账户先行完成。如果税务注册被延误，雇员无法合法在公司领薪水，整个雇佣合规体系就无法建立。$c$,
    $c$- 确认会计事务所已有公司注册信息（CRN + 银行账户）
- 授权会计事务所代为完成所有 HMRC 注册
- 在会计软件（推荐 Xero 或 QuickBooks）上配合创建账号$c$,
    $c$协调会计事务所完成：Corporation Tax 注册（3 个月内，获取 UTR）、PAYE Scheme 注册（雇员入职前激活）、VAT 评估（年营业额接近 £90,000 时提前安排注册）；确认会计软件已上线；核验 UTR 和 PAYE 激活确认。$c$,
    21, ARRAY['UTR 通知书', 'PAYE Scheme 激活确认', '会计软件账户'],
    true, '会员直采（参考价 £720/年薪资申报，Readii 不加价）', 72000)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label, sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s7;

  -- ═══ Stage 8 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence, sku_self_serve_content)
  VALUES (tpl_id, 8, 'stage_08', '基础运营设置', 'Operational Setup', 'always',
    $c$UKVI 在审核 Sponsor Licence 时会逐一核查公司是否"真实对外经营"。官网、公司域名邮箱、Logo、品牌材料——每一项都会在 Appendix A 或合规检查中被核对。用 Gmail 进行商业往来或没有官网的公司会让 UKVI 质疑业务的真实性。$c$,
    $c$- 注册公司域名（.co.uk 或 .com）
- 建立公司官网（含公司名称、主营业务、联系方式、注册地址、CRN、VAT 号如已注册）
- 设置公司域名邮箱（Google Workspace 或 Microsoft 365）：info@、director@ 至少两个地址
- 设计公司 Logo
- 准备中英双语公司简介 PDF
- 为 Director 准备中英文名片$c$,
    $c$（委托版）审核官网内容与 BP 业务方向一致性；核验域名邮箱可用；指导品牌材料合规要点；Sponsor Licence 申请当日对官网截图存档。$c$,
    21, ARRAY['可访问的官网（URL）', '公司域名邮箱', 'Logo 文件', '中英双语公司简介 PDF', 'Director 名片'],
    true, '自助免费（Readii 提供《官网合规 checklist》）', '委托 Readii（£1,799）', 179900,
    $c$Readii 工作台提供《官网合规 checklist》，自助版客户按清单自检即可。完成后将官网链接和截图上传至文档中心，Readii 合规团队做最终确认。$c$)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence,
    sku_self_serve_content = EXCLUDED.sku_self_serve_content
  RETURNING id INTO s8;

  -- ═══ Stage 9 (has variants 9A/9B) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 9, 'stage_09', '业务计划书（BP）制定', 'Business Plan', 'always',
    $c$BP 是 UKVI 审核时间最长、最容易出问题的材料。一份好的 BP 要让 UKVI 相信三件事：① 业务在英国真实可行；② 公司确实需要具有特定专业背景的 sponsored worker；③ 财务预测合理，能持续支付符合 going rate 的薪资。系统根据 Q7 资金规模匹配变体。$c$,
    $c$按匹配变体执行。与 Readii 深度沟通业务细节、提供行业背景、确认财务预测假设、审核 BP 草稿。$c$,
    $c$（委托版）提供结构框架 + 行业模板；协助市场/竞争分析；设计财务预测；合规团队内部审核并出具书面意见。$c$,
    14, ARRAY['Readii 合规团队书面确认通过的完整 BP 文件'],
    true, '自助免费（Readii 提供框架模板）', '委托 Readii（£2,299）', 229900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s9;

  -- ═══ Stage 10 (path_a, has HR sub-module) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence,
    has_sub_module, sub_module_type)
  VALUES (tpl_id, 10, 'stage_10', '雇员入职与 HR 合规（22 项）', 'HR Compliance (22 items)', 'path_a',
    $c$雇员在 Graduate Visa 或其他英国签证期间入职，不意味着合规工作结束。英国雇主对雇员有一套完整的合规义务，这些义务将在 Sponsor Licence 申请时被 UKVI 全面核查。Readii 将 Judy 模型的 22 项 HR 合规要求系统化，确保每一项都有书面记录和可下载的证明文件。$c$,
    $c$- 配合 Readii（或自行）完成 22 项 HR 合规工作
- 确保雇佣合同薪资符合要求（≥£41,700/年或岗位 going rate，取高值）
- 保留所有合规动作的书面记录，上传至文档中心$c$,
    $c$（委托版）按 Judy 22 项模型逐项完成并出具合规报告；提供所有标准模板（雇佣合同、政策文件、入职表单）；建立工作记录体系；生成可下载的《HR 合规审计报告》PDF。$c$,
    14, ARRAY['22 项 HR 合规完成记录', 'HR 合规审计报告（PDF）'],
    true, '自助免费（Readii 提供清单和模板）', '委托 Readii（£3,999）', 399900,
    true, 'hr_compliance')
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence,
    has_sub_module = EXCLUDED.has_sub_module,
    sub_module_type = EXCLUDED.sub_module_type
  RETURNING id INTO s10;

  -- ═══ Stage 11 (path_b) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 11, 'stage_11', '境外协作（雇员远程参与）', 'Overseas Collaboration', 'path_b',
    $c$路径 B 的雇员在获得 Skilled Worker 工签入境英国之前，不能以英国公司雇员身份在英国境内提供劳动服务。但可以在自己所在国以远程方式参与公司业务，薪资通过 PAYE 系统支付并如实申报。这些境外工作记录可以作为公司真实运营的辅助证据，对 Sponsor Licence 申请有帮助。$c$,
    $c$- 与公司约定具体远程工作内容（市场调研、客户沟通、文件起草等）
- 每月提交工作汇报（参照 Readii 月度汇报模板）
- 使用公司域名邮箱进行所有商业往来，保留邮件记录
- 境外雇员不得在持访客签证或免签时在英国境内实际工作$c$,
    $c$- 协调会计事务所对境外薪资的 PAYE 合规处理
- 收集月度工作汇报并存档，作为 Sponsor Licence 辅助证据
- 提醒雇员不前往英国境内进行工作性活动（如必须访英，须以访客身份）$c$,
    180, ARRAY['月度境外工作汇报', '境外 PAYE 申报记录'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s11;

  -- ═══ Stage 12 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 12, 'stage_12', '业务运营与营业额积累', 'Business Operations', 'always',
    $c$这是 Sponsor Licence 申请成败的关键积累期。UKVI 要求看到真实的、可持续的、有财务记录支撑的英国业务。每一份合同、每一笔银行流水、每一次 PAYE 申报，都在为后续申请积累证据。这个阶段最容易被忽视——很多客户在公司注册后进入"等营业额自动增长"的被动模式，等到发现营业额不达标或记录不完整，已经来不及补救。$c$,
    $c$每月固定动作：
财务管理：
- 月末将银行对账单提交至文档中心
- 维持银行余额 ≥£10,000（申请 SL 时须达 ≥£50,000）
- 营业额接近 £90,000 时提前安排 VAT 注册

业务记录：
- 所有合同以公司名义签署并留存
- 对外开具正式发票（含公司名、CRN、VAT、银行信息）
- 使用公司域名邮箱，不用 Gmail
- 保留合同与银行入账的匹配记录

人员管理（路径 A）：
- 雇员月度工作汇报收集存档
- PAYE 月度 RTI 申报准时
- 出勤记录持续更新

里程碑：3 个月累计 £30-50K、6 个月 £100K、9 个月 £150K。$c$,
    $c$（运营陪跑版）
- 每月 1v1 业务规划会议（复盘 + 规划 + 识别合规风险）
- 银行流水合规月度审核
- 合同逐份合规要点审核
- 财务月报 + 税务季度优化
- 24h 紧急合规响应
- 第 3/6/9 个月关键节点主动介入
（自助版）提供每月 checklist，客户自行完成打卡$c$,
    180, ARRAY['月度银行对账单', '月度 PAYE RTI 申报记录', '月度工作汇报', '营业额里程碑达成'],
    true, '自助版（按月 checklist）', '运营陪跑版（£12,999/年）', 1299900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s12;

  -- ═══ Stage 13 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 13, 'stage_13', '实体办公室切换 + 雇主责任险', 'Physical Office + Employer Liability Insurance', 'always',
    $c$UKVI Guidance Part 1（L8.17）明确规定：使用虚拟办公模式的 Sponsor Licence 申请人，UKVI 几乎必然会在批准前安排合规检查，包括对 AO 实际工作地点的上门核查。2026 年 3 月新规更增加了"岗位真实性"的审查要求。实体办公室（共享办公室或注册办公室均可）+ 雇主责任险，是 Appendix A 核心证明文件。必须在 SL 申请前 2-3 个月完成切换。$c$,
    $c$- 选定实体办公地点（WeWork、Regus 等共享办公均可）
- 签署租赁合同（各方签字、显示公司名、在申请时仍有效）
- 购买雇主责任险（保额 ≥£5,000,000，FCA 认可，保单显示实体地址）
- 更新 Companies House 注册地址
- 更新官网和名片地址
- 拍摄 AO 在办公室的工作照（用于合规检查时展示）$c$,
    $c$（委托版）推荐各主要城市共享办公资源比价；审核租赁合同合规要点；协助对比保险报价并核验 FCA 资质；核验保单地址与租赁合同地址一致；提醒更新 Companies House 和官网。$c$,
    21, ARRAY['签署完成的实体办公室租赁合同', '雇主责任险保单（显示实体地址）', '更新后的 Companies House 地址记录'],
    true, '自助免费（Readii 提供指引）', '委托 Readii（£699）', 69900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s13;

  -- ═══ Stage 14 (conditional) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 14, 'stage_14', 'TB 无肺结核体检', 'TB Medical Test', 'conditional',
    $c$来自中国大陆、香港、澳门等指定国家和地区的签证申请人，在递交工签申请前必须提供有效的无肺结核（TB）体检证明。证书有效期仅 6 个月，时机选择非常重要：太早做，证书可能在签证获批前到期；太晚做，如果体检异常需痰液检测，可能延迟最长 8 周，阻断整个工签递交。$c$,
    $c$- 在 Readii 确认的时机窗口内预约 UKVI 认可诊所
- 选择所在城市的认可诊所（中国大陆共 15 个城市 27 家诊所）
- 直接联系诊所预约，不通过第三方中介
- 进行胸部 X 光和健康问卷
- 支付约 ¥550（约 £55-65）
- 正常结果：当天或数天内取得证书
- 异常结果：痰液检测最长 8 周，立即通知 Readii$c$,
    $c$基于 SL 预计获批时间计算最佳体检窗口（提前申请前 3-5 个月）；提供中国大陆 15 个城市 27 家认可诊所名单；设置 6 个月有效期提醒；若 SL 审理超期重新评估体检；到期前 4 周主动提醒。$c$,
    14, ARRAY['有效的无肺结核体检证书（在工签递交时仍在 6 个月有效期内）'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s14;

  -- ═══ Stage 15 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 15, 'stage_15', '申请前财务健康检查', 'Pre-application Financial Health Check', 'always',
    $c$这是 Readii 合规团队在正式提交 Sponsor Licence 申请前进行的最终财务把关。过去 6-12 个月的所有收入记录、银行流水、成本明细都会被系统性复核。这个阶段不是走形式——任何财务瑕疵（流水和发票对不上、有上下游流水但没有书面说明、银行余额不够等）必须在这一步发现并修正，而非等 UKVI 审核时提出 RFE。$c$,
    $c$- 配合整理过去 6-12 个月完整银行对账单
- 提供每笔大额收入对应合同和发票（金额、日期、付款方匹配）
- 对所有成本支出提供合理解释（特别是大额支出）
- 投资人追加资金入账提供资金来源说明
- 配合对审核发现的问题给出详细说明$c$,
    $c$整理 6-12 个月全套银行对账单；核查大额入账 vs 发票/合同；核查 PAYE RTI vs 银行薪资；上下游关联流水单独合规评估；核查办公室/保险时效性；整理 Appendix A 经营证明完整性；出具书面确认意见。$c$,
    14, ARRAY['Readii 合规团队书面确认意见（财务健康检查通过）'],
    true, '仅委托版（Readii 合规团队必做）', 79900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s15;

  -- ═══ Stage 16 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 16, 'stage_16', 'Appendix A 文件准备', 'Appendix A Documents', 'always',
    $c$UKVI Appendix A 要求申请人提供至少 4 份证明文件来证实公司真实经营。文件包完整性、格式规范性、时效在有效期内——任何一个环节出问题，UKVI 会发出 RFE（补件要求），延误 4-8 周。经过阶段 15 的财务检查，所有文件应已就绪，这一步是最终整理和提交前确认。$c$,
    $c$- 确认所有身份文件时效性（护照有效期、AO 的 Companies House 登记截图最新版）
- 配合 Readii 完成文件核对清单$c$,
    $c$完整的 Appendix A 文件包准备（10+ 份）：Companies House 注册证书 + Annual Return；银行对账单（6-12 个月连续）；Corporation Tax UTR + PAYE 激活；实体办公租赁合同；雇主责任险保单；AO 护照 + Director 登记截图；官网当日截图；岗位描述 + 薪资说明；BP 合规版；工作记录样本。统一整理、命名、归档、最终审核。$c$,
    21, ARRAY['完整的 Appendix A 文件包（Readii 合规团队确认可提交状态）'],
    true, '自助免费（Readii 提供清单）', '委托 Readii（£2,499）', 249900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s16;

  -- ═══ Stage 17 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 17, 'stage_17', 'AO 面试辅导', 'AO Interview Coaching', 'always',
    $c$UKVI Guidance Part 1（L8.17）对虚拟办公或新申请公司，在批准前"极有可能"安排合规检查，含上门核查 AO 实际工作地点并面谈。即使有实体办公室也可能安排视频合规访问。如果 AO 回答不了公司业务、岗位设置、sponsored worker 职责的基本问题，SL 可能被拒绝或被授予 B-rating。这一步是保护整个 12 个月投入的最后防线。$c$,
    $c$（自助版）下载并认真阅读《AO 面试准备手册》（30+ 题）；对照自行准备；熟悉公司业务细节、BP 核心财务、sponsored worker 岗位职责、SL 持牌义务。
（委托版 3 次 1v1 模拟）第 1 次英语问答熟悉题型；第 2 次中文深度梳理逻辑；第 3 次全英全真模拟。$c$,
    $c$（委托版）提供《AO 面试准备手册》（30+ 题 + 建议答法 + 陷阱警示）；3 次 1v1 模拟，资深顾问扮演 UKVI 官员；每次提供录像回放和问题分析；出具 AO 准备度评估报告（业务理解/岗位论证/合规义务/英语表达各维度打分）；针对薄弱环节提供强化材料。$c$,
    14, ARRAY['3 次模拟面试录像', 'AO 准备度评估报告（各维度 ≥8/10）'],
    true, '自助免费（《AO 面试准备手册》PDF）', '委托 Readii 3 次 1v1 模拟（£1,499）', 149900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s17;

  -- ═══ Stage 18 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 18, 'stage_18', 'Sponsor Licence 正式申请与审理', 'Sponsor Licence Submission & Review', 'always',
    $c$这是 12 个月工作的核心里程碑。SL 申请通过 UKVI 在线 SMS 系统提交，之后进入 8-12 周审理期。期间 UKVI 可能发出 RFE（补充材料要求），也可能安排合规检查（视频或上门）。任何错误回应或合规检查准备不足，都可能导致拒绝或给予 B-rating。$c$,
    $c$- 支付政府申请费：小型雇主 £574 / 中大型雇主 £1,579
- AO 全程保持手机畅通，随时配合 UKVI
- 审理期内公司继续正常运营，不进行任何结构变更
- 收到 RFE 立即通知 Readii

申请期间合规维护：
- 银行余额 ≥£50K
- 雇员正常工作和工资申报
- 所有工作记录持续更新
- 任何公司变更（股权、Director、地址）必须变更前告知 Readii$c$,
    $c$协调合作律所通过 SMS 系统提交正式申请；每周跟踪审理状态并主动告知；收到 RFE 时律所+合规团队联合起草回应；如安排合规检查，提前通知 AO 准备；配合 AO 在实体办公室迎检。$c$,
    84, ARRAY['Sponsor Licence Reference Number（A-rating）', 'UKVI 批准通知书'],
    true, 'Readii 协调费 £2,499 + 律师费（参考 £5,000）', 249900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s18;

  -- ═══ Stage 19 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 19, 'stage_19', 'Key Personnel 资质审核', 'Key Personnel Audit', 'always',
    $c$获批后，AO、Key Contact、Level 1 User 的资质会成为 UKVI 在合规检查中的重点核查对象。根据 2024 年 12 月 31 日的新规，至少一位 Level 1 User 必须是英国 settled worker（英国国籍或永居）且是公司员工/董事/合伙人，不能外包给律所或顾问。尽早完成资质审核确保 SMS 设置合规。$c$,
    $c$- 提供 AO 完整资质证明：护照、永居/公民身份证明、无犯罪声明
- Key Contact 和 Level 1 User 如是不同人，分别提供同等材料
- 签署 Readii 提供的《Key Personnel 合规声明表》$c$,
    $c$核查三个角色合规资质：长期英国生活工作的身份权利；无破产/债务减免限制令；未被禁止担任董事；Companies House 历史无关联被吊销 SL 记录；出具书面《Key Personnel 合规审核报告》；如发现问题提供替换方案。$c$,
    7, ARRAY['Readii 合规团队签字的《Key Personnel 合规审核报告》'],
    true, '委托 Readii（£499）', 49900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s19;

  -- ═══ Stage 20 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 20, 'stage_20', 'SMS 合规设置', 'SMS Compliance Setup', 'always',
    $c$SL 获批只是开始。AO 必须立即激活 SMS 系统，建立持牌雇主日常合规管理流程。任何对 sponsored worker 状态变化的漏报（辞职未上报、薪资变化超 10% 未通报、迁址未更新）都可能导致 SL 被降级（A→B-rating）甚至吊销。$c$,
    $c$- 使用 UKVI 批准邮件凭证登录 SMS 激活 AO 账户
- 开通 Level 1 User 账户（必须一位 settled worker）
- 熟悉 SMS 基本操作

SMS 规定时间内必须上报：薪资变化 ≥±10%、岗位描述或职责变更、工作地点变化、雇佣终止（10 个工作日内）、连续缺勤超 4 周。$c$,
    $c$提供 SMS 操作手册（中文详细图文）；1v1 指导 AO 完成账户激活和基础配置；培训 AO 和 Level 1 User 的持牌义务。$c$,
    7, ARRAY['SMS 系统正常运行（AO 和 Level 1 User 可登录操作）'],
    true, '自助免费（《SMS 操作手册》）', '委托 Readii（£699）', 69900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s20;

  -- ═══ Stage 21 (path_b) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 21, 'stage_21', 'Defined CoS 申请', 'Defined CoS Application', 'path_b',
    $c$境外申请 Skilled Worker 工签的雇员必须使用 Defined CoS（定义型证书）。与境内 Undefined CoS 不同，Defined CoS 需向 UKVI 单独申请并等待批准（通常 1-5 工作日），有效期 3 个月，雇员必须在这 3 个月内完成工签申请并入境。申请前需雇员所有前置材料（英语、体检等）均就绪。$c$,
    $c$- 确认 Sponsor Licence 已获批且 SMS 正常运行
- 提供雇员最新信息：护照号、拟任岗位描述、工作开始日期
- 确认雇员英语证明、TB 体检证书等前置材料均就绪$c$,
    $c$在 SMS 确认 Defined CoS 分配额度；准备申请材料（护照信息、岗位描述、薪资 ≥£41,700/年或 going rate、预计工作开始日期）；通过 SMS 提交 Defined CoS 申请；获取 CoS Reference Number 后发送给雇员。$c$,
    7, ARRAY['CoS Reference Number（有效期 3 个月，雇员需在此期间递交工签）'],
    true, 'Readii 全程协调 + 材料准备（£10,000）', 1000000)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s21;

  -- ═══ Stage 22 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 22, 'stage_22', '工签申请人面试辅导', 'Applicant Interview Coaching', 'always',
    $c$UKVI 保留对工签申请人进行 Credibility Interview 的权力，对自雇场景尤其容易触发。Credibility Interview 通过电话或视频进行，约 30-60 分钟，全程英语。面试失败导致拒签不仅损失所有政府规费，还会留下记录影响未来申请。$c$,
    $c$（自助版）下载《工签申请人面试准备手册》（40+ 题）；准备英语回答：具体工作职责、如何认识雇主、薪资确定方式、未来 3-5 年职业规划等。
（委托版 2 次 1v1）第 1 次中文逻辑梳理（45 分钟）；第 2 次全英语模拟（45 分钟）。$c$,
    $c$（委托版）提供《申请人面试准备手册》（40+ 题，含自雇场景特殊问题）；2 次 1v1 模拟；自雇场景 Q&A 训练（投资人关系/岗位来源/薪资水平论证）；出具申请人准备度评估报告。$c$,
    7, ARRAY['申请人准备度评估报告（各维度评分 ≥8/10 推荐递交）'],
    true, '自助免费（《申请人面试手册》PDF）', '委托 Readii 2 次 1v1 模拟（£799）', 79900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s22;

  -- ═══ Stage 23 (has variants 23A/23B) ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables, has_sku, sku_self_serve_label, sku_delegate_label, sku_price_pence)
  VALUES (tpl_id, 23, 'stage_23', '工签申请递交', 'Work Visa Submission', 'always',
    $c$所有前置材料（英语证明、CoS、护照、学历、TB、无犯罪如适用）必须在递交时同时完备。任何一项缺失或有效期问题都会导致申请被拒或要求补件。系统根据 visa_path 匹配变体（23A 境内 / 23B 境外）。$c$,
    $c$按匹配变体执行。核对材料清单；完成在线申请表；支付签证费 + IHS；完成生物信息采集。$c$,
    $c$（委托版）在 SMS 为雇员分配 CoS 并支付政府费用；核验申请材料完整性；协助核对表格（合规核验，不提供法律建议）。$c$,
    30, ARRAY['工签批准通知', 'BRP 卡领取通知或 Vignette'],
    true, '自助免费（Readii 提供材料清单）', '委托 Readii（£1,299）', 129900)
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables, has_sku = EXCLUDED.has_sku,
    sku_self_serve_label = EXCLUDED.sku_self_serve_label,
    sku_delegate_label = EXCLUDED.sku_delegate_label,
    sku_price_pence = EXCLUDED.sku_price_pence
  RETURNING id INTO s23;

  -- ═══ Stage 24 ═══
  INSERT INTO journey_stages (template_id, stage_number, stage_code, title, title_en, applies_to,
    description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES (tpl_id, 24, 'stage_24', '入境 / 入职后持续合规', 'Post-Entry & Ongoing Compliance', 'always',
    $c$工签获批不是终点，而是持续 3 年合规义务的开始。SL 的持续有效性建立在持续合规之上。任何漏报、薪资不达标、岗位实质变更——都可能触发 UKVI 合规检查，甚至导致 SL 降级或吊销，影响 sponsored worker 续签和未来 ILR 申请。$c$,
    $c$路径 A（境内入职后）：
- AO 通过 SMS 确认雇员正式开始工作（录入实际入职日期）
- 更新雇员档案：BRP 卡复印件存档、Right to Work 更新至工签
- 确认养老金

路径 B（入境后）：
- 雇员持签证入境，在境内指定地点领取 BRP 卡
- AO 通过 SMS 确认雇员已入境
- 雇员注册 GP 和申请 NIN
- 更新英国居住地址至会计事务所

共同义务：
- 薪资按时发放，RTI 申报准时
- 工作记录持续维护
- SMS 报告义务按规定时间上报$c$,
    $c$工作台设置日历提醒：工签到期（提前 6 个月）、SL 年度复核、雇员 Right to Work 到期；提供路径 A/B 的"入职合规 checklist"；运营陪跑客户持续月度督导。工签到期前 6 个月启动续签评估（going rate、岗位 genuine、SL A-rating）。$c$,
    2555, ARRAY['AO 的 SMS 入职确认记录', '雇员档案更新（BRP 复印件、RTW 记录）', '工作台续签提醒'])
  ON CONFLICT (template_id, stage_number) DO UPDATE SET
    stage_code = EXCLUDED.stage_code, title = EXCLUDED.title, title_en = EXCLUDED.title_en,
    applies_to = EXCLUDED.applies_to, description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables
  RETURNING id INTO s24;

  -- ═══ Variants for stage 2 (2A-2E) ═══
  INSERT INTO stage_variants (stage_id, variant_code, variant_label, trigger_field, trigger_value,
    title, description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES
    (s2, 'variant_2a', '英国学历豁免', 'employee_english_status', 'uk_degree',
      '英语要求 · 英国学历豁免 ✓',
      $c$您在英国完成的本科、硕士或博士学位，满足 UKVI 对 CEFR B2 英语水平的豁免要求（自 2026 年 1 月 8 日起执行）。本阶段只需整理学历证明材料即可，无需参加任何考试。$c$,
      $c$- 找出英国大学颁发的学位证书原件
- 扫描清晰的高清彩色副本（PDF 或 JPEG）
- 上传至 Readii 工作台文档中心→英语证明分类$c$,
      $c$- 核验学历证书由英国获认可大学颁发
- 确认学历类型（本科/硕士/博士）满足豁免
- 整理归入工签申请证明文件包
- 标记阶段完成$c$,
      5, ARRAY['已核验的英国学历证书副本']),
    (s2, 'variant_2b', '英语国家公民豁免', 'employee_nationality', 'english_native',
      '英语要求 · 国籍豁免 ✓',
      $c$您持有以下 18 个国家之一的护照，UKVI 认定这些国家公民的母语为英语，自动满足 B2 要求：美国、澳大利亚、新西兰、加拿大、马耳他、安提瓜和巴布达、巴哈马、巴巴多斯、伯利兹、多米尼克、格林纳达、圭亚那、牙买加、圣基茨和尼维斯、圣卢西亚、圣文森特和格林纳丁斯、特立尼达和多巴哥。$c$,
      $c$- 确认护照国籍与豁免名单一致
- 护照若已过期需更新$c$,
      $c$- 核验护照国籍匹配豁免名单
- 记录豁免依据并归入文件包
- 标记阶段完成$c$,
      3, ARRAY['护照国籍核验记录']),
    (s2, 'variant_2c', 'Ecctis 认证（全英文授课海外学历）', 'employee_english_status', 'ecctis',
      '英语要求 · Ecctis 认证进行中',
      $c$您在海外大学取得的全英文授课学历可通过 Ecctis QLS 认证证明英语水平，豁免 IELTS。硬性约束：审核最长 20 工作日且无加急，依赖大学注册处响应速度。必须签约后立刻启动。如大学回复慢，整体可能 6-8 周。签约后第一周内必须发出 MOI 请求邮件。$c$,
      $c$1. 找到大学 Registrar Office 联系方式
2. 申请 Medium of Instruction（MOI）证明（Readii 提供邮件模板）
3. 在 ecctis.com 创建账号，提交 QLS 申请
4. 支付申请费 £210 + VAT
5. 按 Ecctis 要求上传 MOI
6. 等待最长 20 工作日审核
7. 收到认证代码后转发给 Readii$c$,
      $c$- 提供 MOI 请求邮件中英文模板
- 提供 Ecctis QLS 申请分步指引
- 追踪进度，截止前主动跟进大学注册处
- 收到代码后整理归入工签文件包$c$,
      35, ARRAY['Ecctis QLS 认证代码（7 位数字）']),
    (s2, 'variant_2d', '已有 IELTS/PTE 有效成绩', 'employee_english_status', 'has_valid_score',
      '英语要求 · 成绩核验',
      $c$现有成绩需核验三件事：① 考试版本是否为 UKVI 认可的 SELT 专用版本；② 分数是否达 B2（雅思各项 ≥5.5、PTE 各项 ≥59）；③ 有效期是否在工签递交时仍在 2 年内。$c$,
      $c$- 找到成绩单原件（纸质或电子）
- 记录考试日期，确认在工签递交日前 2 年内
- 上传成绩单至文档中心$c$,
      $c$核验考试机构为 UKVI SELT（IELTS SELT/Pearson UKVI/LANGUAGECERT/PSI/Trinity）；核验 UKVI 专用版本；核验分数达 B2；核验有效期。核验不通过自动转 variant_2e。$c$,
      5, ARRAY['经核验的 SELT 成绩单']),
    (s2, 'variant_2e', '需要参加 IELTS/PTE 考试', 'employee_english_status', 'need_exam',
      '英语要求 · 备考进行中',
      $c$2026 年 1 月 8 日起 Skilled Worker 要求 CEFR B2（四项达标），从 B1 提升至 B2 通常需 8-16 周；加上考位预约（提前约 28 天）、出成绩（2-13 天）及可能补考，建议留 4-6 个月缓冲。必须与公司注册等阶段并行推进。成绩自考试日起 2 年有效，理想时机是 Journey 第 1-3 个月内完成。$c$,
      $c$1. 选考试类型（推荐 IELTS for UKVI）
2. 预约 UKVI 专用版考试（提前 ≥28 天）
3. 备考至达标：IELTS UKVI 各项 ≥5.5、PTE UKVI 各项 ≥59、LANGUAGECERT SELT 各项 B2 通过
4. 考后 2-13 天收成绩
5. 成绩达标后立即上传$c$,
      $c$- 提供 5 家 UKVI 认可考试机构对比
- 提供中国大陆 14 个雅思考场列表和预约链接
- 设置考试倒计时提醒
- 核验成绩达标
- 不达标协助制定补考计划$c$,
      90, ARRAY['SELT 成绩单（各项达 B2，递交时仍在有效期）'])
  ON CONFLICT (stage_id, variant_code) DO UPDATE SET
    variant_label = EXCLUDED.variant_label, trigger_field = EXCLUDED.trigger_field,
    trigger_value = EXCLUDED.trigger_value, title = EXCLUDED.title,
    description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables;

  -- ═══ Variants for stage 4 (4A/4B) ═══
  INSERT INTO stage_variants (stage_id, variant_code, variant_label, trigger_field, trigger_value,
    title, description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES
    (s4, 'variant_4a', '投资人 100% 持股', 'company_structure', 'investor_only',
      '公司结构 · 投资人 100% 持股',
      $c$投资人 100% 持股是最清晰简洁的结构：雇员是纯雇佣关系，不持有任何股权，避免 UKVI 对 owner-operator 的质疑。$c$,
      $c$- 投资人提供护照清晰扫描 + 英国地址证明（3 个月内银行单或水电费）
- 确认公司名称（Readii 协助查重）
- 确认主营业务方向（匹配 SIC Code）
- 确认注册地点
- 确认 AO 候选人并提供同等身份证明$c$,
      $c$- Companies House 查重
- 推荐 SIC Code（2-3 选项）
- 核验 AO 资格（永居证明、无犯罪风险）
- 提供《英国公司注册信息表》模板$c$,
      14, ARRAY['确认的公司名称、注册地、SIC Code、AO 人选、投资人和 AO 身份证明']),
    (s4, 'variant_4b', '投资人持大股 + 雇员少数持股', 'company_structure', 'investor_plus_employee',
      '公司结构 · 投资人 + 雇员共同持股',
      $c$雇员持少量股权可加强"岗位真实性"证明，但需格外小心：UKVI 会关注是否实际为 owner-operator。投资人持股时雇员不担任 Director，一旦被认定 owner-operator，工签可能被拒。雇员持股超 10% 时合规风险显著上升，在任何内部承诺前必须由 Readii 合规团队确认方案可行。$c$,
      $c$- 明确双方持股比例（建议投资人 70-80%，雇员 ≤20%）
- 确认雇员为雇员身份，不担任 Director 或 Company Secretary
- 股权安排书面确认
- 提交合规团队审核后定稿$c$,
      $c$- 审核股权比例
- 核实雇员不任 Director
- 如需要就具体比例征询合规意见
- 提供股东协议基础模板（不含法律建议）$c$,
      14, ARRAY['确认的股权结构方案', '双方持股比例书面确认'])
  ON CONFLICT (stage_id, variant_code) DO UPDATE SET
    variant_label = EXCLUDED.variant_label, trigger_field = EXCLUDED.trigger_field,
    trigger_value = EXCLUDED.trigger_value, title = EXCLUDED.title,
    description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables;

  -- ═══ Variants for stage 6 (6A/6B) ═══
  INSERT INTO stage_variants (stage_id, variant_code, variant_label, trigger_field, trigger_value,
    title, description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES
    (s6, 'variant_6a', 'Director 在英国境内且持合法签证', 'visa_path', 'a_inside_uk',
      '银行开户 · Director 在英国',
      $c$高街银行（Barclays、Lloyds、HSBC、NatWest）账户在 SL 申请中被视为最强的公司真实经营证明。Director 境内持合法签证时成功率最高。银行开户进度决定 PAYE 注册时间，PAYE 是雇员入职前提。$c$,
      $c$- 准备：CRN + 注册证书、所有 Director 和 ≥25% 股东护照 + 英国地址证明、BP 概要 2-3 页、资金来源说明
- 联系高街银行预约开户面谈（提前 2-4 周）
- 参加开户面谈，配合银行尽职调查$c$,
      $c$- 推荐高街银行优先顺序
- 提供 BP 概要撰写指引和资金来源合规表述
- 4 周高街仍未成功时建议 Revolut/Monzo 过渡
- 保留高街拒绝记录作为"已尽力尝试"备案$c$,
      35, ARRAY['公司银行账户（Sort Code + Account Number）']),
    (s6, 'variant_6b', 'Director 在海外或无英国合法签证', 'visa_path', 'b_outside_uk',
      '银行开户 · Director 境外',
      $c$绝大多数高街银行不为境外 Director 开户（行业惯例）。数字银行（Revolut Business、Monzo Business）支持境外线上 KYC，是此情况的主要路径。PAYE 需要银行账户先行，开户延误超 6 周将全面推迟时间线。$c$,
      $c$- 优先在 Revolut Business 线上提交（支持境外，1-3 周）
- 备选 Monzo Business（需英国手机号）
- 同时尝试联系高街银行（即便拒绝也保留拒绝邮件）$c$,
      $c$- 提供 Revolut/Monzo 开户操作指引
- 收集高街拒绝记录，存档作为 Appendix A 补充
- 跟踪进度，超 4 周未成功升级处理$c$,
      35, ARRAY['公司银行账户（至少一个，Sort Code + Account Number）'])
  ON CONFLICT (stage_id, variant_code) DO UPDATE SET
    variant_label = EXCLUDED.variant_label, trigger_field = EXCLUDED.trigger_field,
    trigger_value = EXCLUDED.trigger_value, title = EXCLUDED.title,
    description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables;

  -- ═══ Variants for stage 9 (9A/9B) ═══
  INSERT INTO stage_variants (stage_id, variant_code, variant_label, trigger_field, trigger_value,
    title, description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES
    (s9, 'variant_9a', '标准 BP（£150-200K/年）', 'annual_revenue_target', 'standard',
      'BP · 标准路径',
      $c$BP 要让 UKVI 相信三件事：业务真实可行、公司确实需要特定专业背景的 sponsored worker、财务预测合理可支撑 going rate 薪资。Readii 合规团队出具的是 BP 合规性和财务合理性确认意见，非移民法律建议。如有上下游关联公司流水，必须执行前告知 Readii。$c$,
      $c$- 与 Readii 深度沟通业务细节（产品/客户/市场定位）
- 提供行业背景信息
- 确认 12-24 个月财务预测基本假设
- 审核 BP 草稿，确认技能稀缺性论证$c$,
      $c$- 提供 BP 结构框架和行业写作模板
- 协助市场分析和竞争格局
- 协助设计财务预测（£150-200K 基准场景）
- 合规团队内部审核并出具书面确认意见$c$,
      14, ARRAY['Readii 合规团队书面确认通过的完整 BP 文件']),
    (s9, 'variant_9b', '加速 BP（半年 £100K）', 'annual_revenue_target', 'accelerated',
      'BP · 加速申请路径',
      $c$正常路径下公司需要积累约 9-12 个月运营记录才申请 SL。如半年内实现 £100K 营业额可考虑提前申请。加速 BP 需额外提供加速营收的商业逻辑论证（已签合同、具名客户意向书等）。UKVI 对短期高营收会格外审查真实性。$c$,
      $c$- 同 9A 基本要求
- 额外提供加速营收的商业依据（已有中国客户承诺英国采购、已签框架合同、具名意向书等）
- 加速路径评估结果提交 Readii 合规团队确认$c$,
      $c$- 同 9A
- 额外评估加速路径风险
- 如合规团队不建议加速，自动调整为标准路径并说明理由$c$,
      14, ARRAY['Readii 合规团队书面确认通过的加速路径 BP 及风险说明'])
  ON CONFLICT (stage_id, variant_code) DO UPDATE SET
    variant_label = EXCLUDED.variant_label, trigger_field = EXCLUDED.trigger_field,
    trigger_value = EXCLUDED.trigger_value, title = EXCLUDED.title,
    description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables;

  -- ═══ Variants for stage 23 (23A/23B) ═══
  INSERT INTO stage_variants (stage_id, variant_code, variant_label, trigger_field, trigger_value,
    title, description_why, description_customer_action, description_readii_action,
    estimated_duration_days, deliverables)
  VALUES
    (s23, 'variant_23a', '境内工签申请（路径 A）', 'visa_path', 'a_inside_uk',
      '工签申请 · 境内（路径 A）',
      $c$所有前置材料（英语、CoS、护照、学历等）必须在递交时同时完备。境内申请优势是审理期内仍可在英国生活工作（现有签证保护）；劣势是标准审理时间约 8 周。加急（额外付费）5-10 天。$c$,
      $c$- 确认所有材料就绪（Readii 清单）
- 在线完成工签申请表（gov.uk/skilled-worker-visa）
- 支付签证费 £827（境内 3 年）
- 支付 IHS £3,105（£1,035 × 3 年）
- 预约 UKVCAS 采集生物信息$c$,
      $c$- 在 SMS 为雇员分配 Undefined CoS
- 支付 CoS 分配费 £525（雇主承担）
- 支付 Immigration Skills Charge（小型雇主 £364/年 × 3 = £1,092）
- 核验材料完整性
- 协助核对申请表（合规核验）$c$,
      56, ARRAY['工签批准通知', 'BRP 卡领取通知']),
    (s23, 'variant_23b', '境外工签申请（路径 B）', 'visa_path', 'b_outside_uk',
      '工签申请 · 境外（路径 B）',
      $c$境外申请速度更快（标准约 3 周，加急约 5 天），但前置材料要求更严：TB 体检、无犯罪（如适用）、英语必须全部就绪且在递交时均有效。有效期交叉管理（TB 6 个月、CRC 6 个月、英语 2 年）需精确计算和预警。$c$,
      $c$- 确认所有材料就绪（含 TB、CRC 如适用）
- 在线完成工签申请表
- 支付境外签证费 £769（3 年）
- 支付 IHS £3,105
- 在所在国 VFS Global 或 TLS Contact 递交并采集生物信息$c$,
      $c$- 同 23A 的 CoS 分配和政府费用代缴
- 额外核验：TB 证书/无犯罪/英语成绩有效期
- 确认所有材料在递交时均有效
- 提供境外 VFS/TLS 预约指引$c$,
      21, ARRAY['工签批准通知（Vignette 贴纸签证）', '入境后领取 BRP 卡指引'])
  ON CONFLICT (stage_id, variant_code) DO UPDATE SET
    variant_label = EXCLUDED.variant_label, trigger_field = EXCLUDED.trigger_field,
    trigger_value = EXCLUDED.trigger_value, title = EXCLUDED.title,
    description_why = EXCLUDED.description_why,
    description_customer_action = EXCLUDED.description_customer_action,
    description_readii_action = EXCLUDED.description_readii_action,
    estimated_duration_days = EXCLUDED.estimated_duration_days,
    deliverables = EXCLUDED.deliverables;

  -- Sync total_stages to actual row count
  UPDATE journey_templates
    SET total_stages = (SELECT COUNT(*) FROM journey_stages WHERE template_id = tpl_id)
    WHERE id = tpl_id;
END $seed$;
