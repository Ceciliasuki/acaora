# 专业研究工作台发布

用户授权“完成后部署”。本次发布从正式 `fdc533f687193ea57d34ec6d9ec3df731f7f80bb` 起，包含研究上下文衔接、结构化实证设计、八项专业研究能力、六项贯通工具和显式项目协作。课程保持相对独立。

实现与本地证据：

- [研究衔接](../reviews/2026-10-24-research-continuity.md)
- [实证研究工作台](../reviews/2026-10-24-empirical-research-workbench.md)
- [八项专业研究能力](../reviews/2026-10-25-professional-research-eight.md)
- [贯通工具与协作](../reviews/2026-10-25-connected-research-tools.md)

数据库扩展已生效，原项目不自动共享，不上传原始文件，不写入真实用户测试记录。上线复用已有本地有效证据，由新 HEAD 的 CI 完成类型、lint、单元/数据库、生产构建、受控 E2E 和真实科学 Python companion 检查；失败只处理对应问题。

CI 成功后合并触发现有主分支部署。需核实 `origin/main`、合并 SHA 和 `https://acaora.cn/api/version` 的完整 SHA 一致且环境为 production，再核对公开受影响入口。真实账户协作、邮件与研究内容不由 mock 通过推断为已验收。精确流水线、版本和公开浏览器证据保存在忽略目录 `outputs/release-research-2026-10-25/`，不为补写日志额外部署。

回退采用回退本次合并提交；保留数据库扩展和历史，不执行删表或原始数据迁移。专业记录先导出备份；旧客户端不具备编辑新类型记录的能力。
