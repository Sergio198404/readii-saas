# Readii SaaS — 销售看板

## 产品定位
Readii 销售 CRM，中英跨境签证咨询业务专用

## 技术栈
- 前端：Vite + React
- 后端：Supabase
- 部署：Netlify

## 本项目与 ReadiiOS 完全独立
不要引用、混入任何 ReadiiOS 的代码或逻辑

## 数据库
Supabase project ID: qvuewcavzjdzoajujjma

## 核心规则
- 所有数据存 Supabase，不用 localStorage
- API 调用走后端代理，不直连 Anthropic
