# 任务 02：角色扩展和登录路由

## 目标

v1 有 4 种角色（客户、渠道、咨询师、Admin），且**一个用户可能同时是多个角色**（例如苏晓宇本人是 admin + consultant，某些客户可能同时是 customer + partner）。这个任务建立：

1. 登录后根据角色自动跳转到合适的首页
2. 当用户有多个角色时提供"身份切换器"
3. 路由保护（未登录用户、没有权限的用户看不到对应页面）

## 前置条件

- 任务 01 已完成（`profiles` 表有 role_customer、role_partner、role_consultant、role_admin 字段）

## 上下文

参考 `docs/v1_product_manual.md` 的：
- 第 0.3 节（四端角色矩阵）
- 第 3.1 节（路由结构）

## 具体任务

### 1. 创建角色权限工具

**文件**：`src/lib/roles.js`

```javascript
// 定义角色常量
export const ROLES = {
  CUSTOMER: 'customer',
  PARTNER: 'partner',
  CONSULTANT: 'consultant',
  ADMIN: 'admin',
};

// 从 profile 提取角色数组
export function getUserRoles(profile) {
  if (!profile) return [];
  const roles = [];
  if (profile.role_customer) roles.push(ROLES.CUSTOMER);
  if (profile.role_partner) roles.push(ROLES.PARTNER);
  if (profile.role_consultant) roles.push(ROLES.CONSULTANT);
  if (profile.role_admin) roles.push(ROLES.ADMIN);
  return roles;
}

// 判断用户是否有某个角色
export function hasRole(profile, role) {
  return getUserRoles(profile).includes(role);
}

// 获取默认登录后的跳转路径
export function getDefaultRoute(profile) {
  const roles = getUserRoles(profile);
  if (roles.length === 0) return '/'; // 无角色跳营销首页

  // 优先顺序：customer > partner > consultant > admin
  if (roles.includes(ROLES.CUSTOMER)) return '/customer/dashboard';
  if (roles.includes(ROLES.PARTNER)) return '/partner/dashboard';
  if (roles.includes(ROLES.CONSULTANT)) return '/consultant/dashboard';
  if (roles.includes(ROLES.ADMIN)) return '/admin';
  return '/';
}

// 每个角色的基础路径
export const ROLE_BASE_PATHS = {
  [ROLES.CUSTOMER]: '/customer',
  [ROLES.PARTNER]: '/partner',
  [ROLES.CONSULTANT]: '/consultant',
  [ROLES.ADMIN]: '/admin',
};

// 路径对应的必需角色
export function getRequiredRoleFromPath(pathname) {
  if (pathname.startsWith('/customer')) return ROLES.CUSTOMER;
  if (pathname.startsWith('/partner')) return ROLES.PARTNER;
  if (pathname.startsWith('/consultant')) return ROLES.CONSULTANT;
  if (pathname.startsWith('/admin')) return ROLES.ADMIN;
  return null;
}
```

### 2. 创建 Role Context

**文件**：`src/contexts/RoleContext.jsx`

```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getUserRoles, getDefaultRoute } from '../lib/roles';

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [currentRole, setCurrentRole] = useState(null); // 用户当前选择的身份
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 监听 auth 变化
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setCurrentRole(null);
          setLoading(false);
        }
      }
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setProfile(data);
      // 从 localStorage 恢复上次的身份选择，如果没有则用默认
      const savedRole = localStorage.getItem(`readii_role_${userId}`);
      const userRoles = getUserRoles(data);
      if (savedRole && userRoles.includes(savedRole)) {
        setCurrentRole(savedRole);
      } else if (userRoles.length > 0) {
        setCurrentRole(userRoles[0]);
      }
    }
    setLoading(false);
  }

  function switchRole(role) {
    const userRoles = getUserRoles(profile);
    if (!userRoles.includes(role)) {
      console.error('User does not have role:', role);
      return;
    }
    setCurrentRole(role);
    localStorage.setItem(`readii_role_${user.id}`, role);
    // 触发路由跳转（由消费组件处理）
  }

  return (
    <RoleContext.Provider value={{
      user, profile, currentRole, loading,
      roles: getUserRoles(profile),
      switchRole,
      reload: () => user && loadProfile(user.id),
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used inside RoleProvider');
  return ctx;
}
```

### 3. 创建路由保护组件

**文件**：`src/components/ProtectedRoute.jsx`

```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { hasRole, getRequiredRoleFromPath } from '../lib/roles';

export function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useRole();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleToCheck = requireRole || getRequiredRoleFromPath(location.pathname);

  if (roleToCheck && !hasRole(profile, roleToCheck)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
```

### 4. 创建身份切换器组件

**文件**：`src/components/RoleSwitcher.jsx`

```jsx
import { useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { ROLE_BASE_PATHS, ROLES } from '../lib/roles';

const ROLE_LABELS = {
  [ROLES.CUSTOMER]: '客户',
  [ROLES.PARTNER]: '渠道合伙人',
  [ROLES.CONSULTANT]: '咨询师',
  [ROLES.ADMIN]: '管理员',
};

export function RoleSwitcher() {
  const { roles, currentRole, switchRole } = useRole();
  const navigate = useNavigate();

  if (roles.length <= 1) return null; // 只有一个角色不显示

  function handleSwitch(e) {
    const role = e.target.value;
    switchRole(role);
    navigate(ROLE_BASE_PATHS[role]);
  }

  return (
    <select
      value={currentRole || roles[0]}
      onChange={handleSwitch}
      className="px-3 py-1 border rounded text-sm"
    >
      {roles.map(r => (
        <option key={r} value={r}>切换到：{ROLE_LABELS[r]}</option>
      ))}
    </select>
  );
}
```

### 5. 更新路由配置

**文件**：`src/App.jsx`（或你现有的路由配置文件）

在现有路由基础上新增：

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// ... 其他导入

function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          {/* 公开路由（现有） */}
          <Route path="/" element={<MarketingHomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* 登录后跳转路由 */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardRouter /></ProtectedRoute>
          } />

          {/* 客户端路由（下个任务填充内容，这里先占位） */}
          <Route path="/customer/*" element={
            <ProtectedRoute requireRole="customer">
              <CustomerRoutes />
            </ProtectedRoute>
          } />

          {/* 渠道端 */}
          <Route path="/partner/*" element={
            <ProtectedRoute requireRole="partner">
              <PartnerRoutes />
            </ProtectedRoute>
          } />

          {/* 咨询师端 */}
          <Route path="/consultant/*" element={
            <ProtectedRoute requireRole="consultant">
              <ConsultantRoutes />
            </ProtectedRoute>
          } />

          {/* Admin（现有扩展） */}
          <Route path="/admin/*" element={
            <ProtectedRoute requireRole="admin">
              <AdminRoutes />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  );
}
```

### 6. 创建占位页面

本任务只建立骨架，真正的内容由后续任务填充。先创建占位页面：

```
src/pages/customer/
├── CustomerLayout.jsx    (侧边栏 + 主内容区)
├── CustomerDashboard.jsx (占位："客户工作台建设中")
└── routes.jsx            (Customer 路由定义)

src/pages/partner/
├── PartnerLayout.jsx
├── PartnerDashboard.jsx  (占位)
└── routes.jsx

src/pages/consultant/
├── ConsultantLayout.jsx
├── ConsultantDashboard.jsx (占位)
└── routes.jsx

src/pages/UnauthorizedPage.jsx (显示："您没有权限访问此页面")
src/pages/DashboardRouter.jsx (根据角色跳转)
```

`DashboardRouter.jsx` 的实现：

```jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { getDefaultRoute } from '../lib/roles';

export function DashboardRouter() {
  const { profile } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      navigate(getDefaultRoute(profile), { replace: true });
    }
  }, [profile, navigate]);

  return <div>正在跳转...</div>;
}
```

### 7. 顶部导航集成 RoleSwitcher

在现有的顶部导航组件（`src/components/Navbar.jsx` 或类似文件）加入 `<RoleSwitcher />`。

## 验收标准

- [ ] 创建测试用户 A：只有 role_customer=true
- [ ] 创建测试用户 B：role_customer=true + role_partner=true
- [ ] 创建测试用户 C：role_admin=true + role_consultant=true
- [ ] 用户 A 登录后自动跳转到 /customer/dashboard（看到占位页）
- [ ] 用户 A 访问 /partner 被跳转到 /unauthorized
- [ ] 用户 B 登录后默认到 /customer/dashboard，顶部有身份切换器，切换到 partner 后跳到 /partner/dashboard
- [ ] 用户 C 登录后默认到 /consultant（consultant 优先级高于 admin）
- [ ] 未登录访问 /customer 自动跳到 /login
- [ ] 所有现有销售看板路由（如 /sales-board）继续正常工作

## 不要做的事

- ❌ 不要实现 customer/partner/consultant 页面的具体内容（下一批任务做）
- ❌ 不要改动现有的 admin 路由（只是扩展）
- ❌ 不要实现注册流程的角色选择（v1 阶段所有角色由 admin 手动开通）
- ❌ 不要使用 localStorage 存敏感信息，只存 currentRole

## 可能的 gotchas

**Gotcha 1**：Supabase RLS 可能阻止读取 profile
- 对策：`profiles` 表必须允许用户读取自己的记录，RLS 策略：`auth.uid() = id`

**Gotcha 2**：现有的 App.jsx 已经有路由
- 对策：不要全部重写，只是在现有路由外包裹 RoleProvider，并新增 /customer /partner /consultant 路由

**Gotcha 3**：localStorage 在 SSR 不可用
- 对策：Vite + React 是 SPA，不用考虑 SSR；但如果报错，用 `typeof window !== 'undefined'` 判断

## 完成后的 commit message

```
feat(auth): add multi-role routing and role switcher

- Add role helper utilities in src/lib/roles.js
- Add RoleContext provider with profile loading
- Add ProtectedRoute component with role-based access
- Add RoleSwitcher component for users with multiple roles
- Add placeholder pages for customer/partner/consultant dashboards
- Configure route guards for /customer, /partner, /consultant, /admin paths
```

## 完成后更新 PROGRESS.md

```markdown
## 任务 2：角色扩展和登录路由 ✅
- 完成日期：[填入]
- 新增组件：RoleProvider, ProtectedRoute, RoleSwitcher
- 新增路由：/customer/*, /partner/*, /consultant/*
- 备注：[如果遇到什么特殊情况]
```
