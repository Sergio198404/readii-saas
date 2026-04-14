-- v0.7.0: content_topics 状态语义纠正
-- 之前数据库里 `待创作` 和 `已发布` 的值是反的，用三步重命名把它们对调
update public.content_topics set status = '__tmp_待创作__' where status = '待创作';
update public.content_topics set status = '待创作' where status = '已发布';
update public.content_topics set status = '已发布' where status = '__tmp_待创作__';
