# 任务 03：客户工作台骨架

## 目标

搭建客户登录后看到的工作台界面骨架：左侧导航 + 顶部客户信息栏 + 主内容区的 Dashboard 页面。这个任务聚焦**视觉骨架和 API 基础**，真正的 journey 数据内容由任务 04 填充。

## 前置条件

- 任务 01（数据库 Schema）已完成
- 任务 02（角色路由）已完成，`/customer/*` 路由已保护

## 上下文

参考 `docs/v1_product_manual.md`：
- 第 2.1.1 节（`GET /api/customer/dashboard` API 定义）
- 第 3.2 节（customer 组件清单）
- 第 3.3 节（客户工作台首页必须包含的 7 个区块）

## 具体任务

### 1. 设计视觉规范

在 `src/pages/customer/CustomerLayout.jsx` 实现基本布局：

```
┌─────────────────────────────────────────────────────────┐
│ [Logo Readii]        [客户名] [身份切换器] [头像]           │  ← 顶部导航
├─────────┬───────────────────────────────────────────────┤
│ 工作台   │                                               │
│ 我的进度 │                                               │
│ 我的文档 │         主内容区（Outlet）                     │
│ 问答     │                                               │
│ 会议     │                                               │
│ 设置     │                                               │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

**视觉规范**：
- 配色沿用现有 Readii 销售看板（如果有，检查 tailwind.config.js）
- 左侧导航 240px 宽
- 顶部导航 64px 高
- 主内容区自适应
- 使用 Tailwind CSS（沿用现有）

### 2. 创建客户端 API 调用

**文件**：`src/lib/api/customer.js`

```javascript
import { supabase } from '../supabase';

// 获取客户的完整 Dashboard 数据
export async function getCustomerDashboard() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. 获取客户档案
  const { data: customer, error: customerError } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (customerError || !customer) {
    throw new Error('Customer profile not found');
  }

  // 2. 获取当前 journey template（如果已关联）
  let template = null;
  let stages = [];
  let progress = [];

  if (customer.service_type) {
    const { data: templateData } = await supabase
      .from('journey_templates')
      .select('*')
      .eq('service_type', customer.service_type)
      .eq('is_active', true)
      .single();

    if (templateData) {
      template = templateData;

      // 获取所有阶段
      const { data: stagesData } = await supabase
        .from('journey_stages')
        .select('*')
        .eq('template_id', template.id)
        .order('stage_number', { ascending: true });

      stages = stagesData || [];

      // 获取客户的进度
      const { data: progressData } = await supabase
        .from('customer_journey_progress')
        .select('*')
        .eq('customer_id', customer.id);

      progress = progressData || [];
    }
  }

  // 3. 获取最近文档
  const { data: recentDocs } = await supabase
    .from('customer_documents')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('is_visible_to_customer', true)
    .order('created_at', { ascending: false })
    .limit(5);

  // 4. 获取即将到来的会议
  const { data: upcomingMeetings } = await supabase
    .from('customer_meetings')
    .select('*')
    .eq('customer_id', customer.id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(3);

  // 5. 获取待回答的问题（最近 5 个）
  const { data: recentQa } = await supabase
    .from('customer_qa')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    customer,
    template,
    stages,
    progress,
    recentDocs: recentDocs || [],
    upcomingMeetings: upcomingMeetings || [],
    recentQa: recentQa || [],
  };
}

// 获取当前客户的 current_stage 详情
export function getCurrentStageDetails(dashboardData) {
  const { customer, stages, progress } = dashboardData;
  if (!customer.current_stage_id) {
    return stages.find(s => s.stage_number === 1);
  }
  return stages.find(s => s.id === customer.current_stage_id);
}

// 计算完成百分比
export function calculateProgress(stages, progress) {
  if (stages.length === 0) return 0;
  const completedCount = progress.filter(p => p.status === 'completed').length;
  return Math.round((completedCount / stages.length) * 100);
}
```

### 3. 创建 Layout 组件

**文件**：`src/pages/customer/CustomerLayout.jsx`

```jsx
import { Outlet, NavLink } from 'react-router-dom';
import { RoleSwitcher } from '../../components/RoleSwitcher';
import { useRole } from '../../contexts/RoleContext';

const NAV_ITEMS = [
  { to: '/customer/dashboard', label: '工作台', icon: '📊' },
  { to: '/customer/journey', label: '我的进度', icon: '🗺️' },
  { to: '/customer/documents', label: '我的文档', icon: '📁' },
  { to: '/customer/qa', label: '问答', icon: '💬' },
  { to: '/customer/meetings', label: '会议', icon: '🗓️' },
  { to: '/customer/settings', label: '设置', icon: '⚙️' },
];

export function CustomerLayout() {
  const { profile } = useRole();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top Nav */}
      <header className="h-16 bg-white border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="text-xl font-semibold">Readii</span>
          <span className="text-sm text-gray-500">客户工作台</span>
        </div>
        <div className="flex items-center gap-4">
          <RoleSwitcher />
          <span className="text-sm">{profile?.full_name || profile?.email}</span>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            {profile?.full_name?.[0] || '?'}
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex">
        {/* Left Nav */}
        <aside className="w-60 bg-white border-r">
          <nav className="py-4">
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 hover:bg-gray-100 ${
                    isActive ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600' : 'text-gray-700'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 4. 创建 Dashboard 页面

**文件**：`src/pages/customer/CustomerDashboard.jsx`

```jsx
import { useEffect, useState } from 'react';
import { getCustomerDashboard, calculateProgress, getCurrentStageDetails } from '../../lib/api/customer';
import { JourneyProgressBar } from '../../components/customer/JourneyProgressBar';
import { CurrentStageCard } from '../../components/customer/CurrentStageCard';
import { QuickActionPanel } from '../../components/customer/QuickActionPanel';
import { UpcomingMeetings } from '../../components/customer/UpcomingMeetings';

export function CustomerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCustomerDashboard()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>加载中...</div>;
  if (error) return <div className="text-red-600">错误：{error}</div>;
  if (!data) return <div>暂无数据</div>;

  const { customer, stages, progress } = data;
  const currentStage = getCurrentStageDetails(data);
  const progressPercent = calculateProgress(stages, progress);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 顶部欢迎区 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">
          你好，{data.customer.full_name || '客户'}
        </h1>
        <div className="flex gap-6 text-sm text-gray-600">
          <div>
            服务类型：<span className="font-medium text-gray-900">
              {getServiceTypeLabel(customer.service_type)}
            </span>
          </div>
          <div>
            签约日期：<span className="font-medium text-gray-900">
              {customer.signed_date}
            </span>
          </div>
          <div>
            预计完成：<span className="font-medium text-gray-900">
              {customer.expected_completion_date || '待定'}
            </span>
          </div>
        </div>
      </div>

      {/* 进度条 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">服务进度</h2>
        <JourneyProgressBar
          stages={stages}
          progress={progress}
          currentStageId={customer.current_stage_id}
        />
        <div className="mt-4 text-sm text-gray-600">
          完成度：{progressPercent}% ({progress.filter(p => p.status === 'completed').length}/{stages.length})
        </div>
      </div>

      {/* 当前阶段大卡片 */}
      {currentStage && (
        <CurrentStageCard stage={currentStage} />
      )}

      {/* 下方两栏 */}
      <div className="grid grid-cols-2 gap-6">
        <QuickActionPanel customer={customer} />
        <UpcomingMeetings meetings={data.upcomingMeetings} />
      </div>
    </div>
  );
}

function getServiceTypeLabel(type) {
  const labels = {
    'sw_self_sponsored': '自雇工签全案',
    'innovator_founder': '创新签陪跑',
    'expansion_worker': '拓展工签',
    'general_consulting': '综合咨询',
  };
  return labels[type] || type;
}
```

### 5. 创建核心子组件

**文件**：`src/components/customer/JourneyProgressBar.jsx`

```jsx
export function JourneyProgressBar({ stages, progress, currentStageId }) {
  const progressMap = Object.fromEntries(
    (progress || []).map(p => [p.stage_id, p.status])
  );

  return (
    <div className="relative">
      {/* 背景线 */}
      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />

      {/* 进度线 */}
      <div
        className="absolute top-4 left-4 h-0.5 bg-blue-500 transition-all"
        style={{
          width: `calc(${(completedRatio(progress, stages) * 100)}% - 8px)`
        }}
      />

      {/* 节点 */}
      <div className="relative flex justify-between">
        {stages.map((stage, idx) => {
          const status = progressMap[stage.id] || 'pending';
          const isCurrent = currentStageId === stage.id;
          return (
            <div key={stage.id} className="flex flex-col items-center">
              <div className={`
                w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold
                ${status === 'completed' ? 'bg-blue-500 text-white border-blue-500' :
                  isCurrent ? 'bg-white border-blue-500 text-blue-500' :
                  'bg-white border-gray-300 text-gray-400'}
              `}>
                {status === 'completed' ? '✓' : idx + 1}
              </div>
              <div className={`
                mt-2 text-xs max-w-20 text-center truncate
                ${isCurrent ? 'text-blue-600 font-medium' : 'text-gray-500'}
              `}>
                {stage.title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function completedRatio(progress, stages) {
  if (!stages.length) return 0;
  const completed = (progress || []).filter(p => p.status === 'completed').length;
  return completed / stages.length;
}
```

**文件**：`src/components/customer/CurrentStageCard.jsx`

```jsx
export function CurrentStageCard({ stage }) {
  if (!stage) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-sm text-gray-500 mb-1">
            第 {stage.stage_number} 步 · 预计 {stage.estimated_duration_days} 天
          </div>
          <h2 className="text-xl font-semibold">{stage.title}</h2>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
          进行中
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        {/* 为什么重要 */}
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-900 mb-2">
            💡 为什么重要
          </div>
          <div className="text-sm text-gray-700">
            {stage.description_why}
          </div>
        </div>

        {/* 你需要做什么 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900 mb-2">
            ✅ 你需要做什么
          </div>
          <div className="text-sm text-gray-700">
            {stage.description_customer_action}
          </div>
        </div>

        {/* Readii 在做什么 */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm font-medium text-green-900 mb-2">
            🔧 Readii 在做什么
          </div>
          <div className="text-sm text-gray-700">
            {stage.description_readii_action}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**文件**：`src/components/customer/QuickActionPanel.jsx`

```jsx
import { Link } from 'react-router-dom';

export function QuickActionPanel({ customer }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/customer/qa"
          className="p-4 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
        >
          <span className="text-2xl">💬</span>
          <div>
            <div className="font-medium">问一个问题</div>
            <div className="text-xs text-gray-500">24小时内回复</div>
          </div>
        </Link>
        <Link
          to="/customer/meetings"
          className="p-4 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
        >
          <span className="text-2xl">🗓️</span>
          <div>
            <div className="font-medium">约一次会议</div>
            <div className="text-xs text-gray-500">视频或电话</div>
          </div>
        </Link>
        <Link
          to="/customer/documents"
          className="p-4 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
        >
          <span className="text-2xl">📎</span>
          <div>
            <div className="font-medium">上传文档</div>
            <div className="text-xs text-gray-500">PDF、图片</div>
          </div>
        </Link>
        <Link
          to="/customer/journey"
          className="p-4 border rounded-lg hover:bg-gray-50 flex items-center gap-3"
        >
          <span className="text-2xl">🗺️</span>
          <div>
            <div className="font-medium">查看完整路径</div>
            <div className="text-xs text-gray-500">18 步全览</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
```

**文件**：`src/components/customer/UpcomingMeetings.jsx`

```jsx
export function UpcomingMeetings({ meetings }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">即将到来的会议</h2>
      {meetings.length === 0 ? (
        <div className="text-gray-500 text-sm">暂无预约的会议</div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <div key={m.id} className="border rounded-lg p-3">
              <div className="font-medium">{m.title}</div>
              <div className="text-sm text-gray-500 mt-1">
                {new Date(m.scheduled_at).toLocaleString('zh-CN')}
              </div>
              {m.meeting_link && (
                <a
                  href={m.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 text-sm mt-2 inline-block"
                >
                  加入会议 →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6. 路由注册

在 `src/pages/customer/routes.jsx`（在任务 2 中已创建）：

```jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { CustomerLayout } from './CustomerLayout';
import { CustomerDashboard } from './CustomerDashboard';

export function CustomerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CustomerLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="journey" element={<div>我的进度（待实现）</div>} />
        <Route path="documents" element={<div>我的文档（待实现）</div>} />
        <Route path="qa" element={<div>问答（待实现）</div>} />
        <Route path="meetings" element={<div>会议（待实现）</div>} />
        <Route path="settings" element={<div>设置（待实现）</div>} />
      </Route>
    </Routes>
  );
}
```

## 验收标准

- [ ] 用测试客户账号登录，自动跳到 `/customer/dashboard`
- [ ] Dashboard 页面显示客户姓名、服务类型、签约日期
- [ ] 即使 `customer_profiles` 表里该用户还没有数据，也能显示"客户档案不存在"的友好提示（不能白屏）
- [ ] Layout 的左侧导航能正常切换
- [ ] 身份切换器（如果用户有多角色）正常显示
- [ ] 进度条组件能根据传入数据正确渲染（可以用测试数据）
- [ ] 当前阶段大卡片三栏布局美观（为什么 / 你做什么 / Readii 做什么）
- [ ] 快捷操作四个按钮全部可点击（点击后跳转到占位页面）

## 测试数据准备

在 Supabase 里手动插入一条测试数据：

```sql
-- 假设 auth.users 里已有一个测试用户（邮箱 test_customer@readii.co.uk）
-- 先找到这个用户的 id

-- 1. 确保 profiles 表的 role_customer = true
UPDATE profiles
  SET role_customer = true,
      full_name = '测试客户'
  WHERE email = 'test_customer@readii.co.uk';

-- 2. 创建一条 customer_profiles 记录
INSERT INTO customer_profiles (
  user_id, service_type, signed_date,
  total_contract_value_pence, paid_amount_pence
) VALUES (
  (SELECT id FROM profiles WHERE email = 'test_customer@readii.co.uk'),
  'sw_self_sponsored',
  '2026-04-01',
  3500000, 1750000
);
```

暂时不创建 journey_template 和 stages，那是下个任务的事。当前阶段 Dashboard 能显示客户信息但没有阶段数据，是正常的。

## 不要做的事

- ❌ 不要实现 journey 完整页面（任务 04）
- ❌ 不要实现文档上传（任务 06）
- ❌ 不要实现 QA 交互（任务 05）
- ❌ 不要实现会议预约逻辑（v1 简化版，先只显示 admin 创建的会议）

## 完成后的 commit message

```
feat(customer): add customer workspace skeleton with layout and dashboard

- Add CustomerLayout with left sidebar and top nav
- Add CustomerDashboard page showing progress bar, current stage card, quick actions
- Add core components: JourneyProgressBar, CurrentStageCard, QuickActionPanel, UpcomingMeetings
- Add getCustomerDashboard API wrapper in src/lib/api/customer.js
- Register customer routes under /customer/*
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 3：客户工作台骨架 ✅
- 完成日期：[填入]
- 测试用户：test_customer@readii.co.uk
- 页面：/customer/dashboard
- 备注：[备注]
```
