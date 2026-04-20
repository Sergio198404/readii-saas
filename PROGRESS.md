# Readii v1 开发进度

## 任务 1：数据库 Schema 部署 ⏳
- 状态：迁移文件已创建，待在 Supabase 执行
- 新增表数量：19（含 lead_conversations 的 index 表）
- 迁移文件：6
- 备注：profiles 表已有 full_name / avatar_url，跳过重复添加；现有 partners 表保留不动，新建 partner_profiles 作为 v1 扩展表
