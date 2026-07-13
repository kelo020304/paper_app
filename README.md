# Paper Vault

一个面向 arXiv 的本地优先 AI 论文工作台。macOS 和 Linux 使用同一套 Electron 代码，论文、分类、HTML 解析和 Related Works 通过 GitHub 私有仓库近实时同步。

## 已实现

- 粘贴 arXiv 编号、摘要页或 PDF 链接自动导入
- 自动获取标题、作者、摘要、分类和版本信息
- 可选下载 PDF，并用系统 PDF 阅读器打开
- 待读 / 阅读中 / 已读、收藏、标签、全文搜索和排序
- 每篇论文独立保存元数据与 Markdown 笔记，便于 Git 合并和回溯
- 一键打开幻觉翻译 HJFY 的对应中文论文
- ChatGPT/Codex 账号或 OpenAI API Key 两种 AI 连接方式
- 导入后自动价值评价、分类，并生成详细但不冗余的 `analysis.html`
- 手动建立彩色分类、移动论文；每个分类增量维护 `related-works.md`
- 关键论文使用 `gpt-image-2` 生成方法原理图（需 OpenAI API Key）
- 每天 09:00 根据关键词筛选最新 arXiv，AI 选出最多 5 篇
- 每日论文进入带日期的紫色分类，同时保留自动生成的主题分类
- 人工加入为橙色、每日抓取为紫色，侧栏提供来源 legend
- 默认连接 `git@github.com:kelo020304/paper_app.git` 的 `vault` 分支
- 修改后约 2 秒自动推送，另一台设备每 30 秒自动拉取，也可手动同步
- 可在设置中切换本地论文库目录

## 本地运行

需要 Node.js 22+、npm/pnpm 和 Git。ChatGPT 账号模式还需要本机安装并登录 Codex；也可以在设置中改用 OpenAI API Key。

```bash
cd paper-vault
npm install
npm start
```

运行测试：

```bash
npm test
```

## GitHub 同步设置

本项目默认使用同一个 GitHub 仓库的两个分支：

- `main` 保存应用源码。
- `vault` 保存论文元数据、笔记和可选 PDF。

1. 使用 SSH key，或先执行 `gh auth login` 让 Git 具备 GitHub 凭据。
2. 首次启动会自动初始化本地论文库，并连接 `vault` 分支。
3. 修改论文后约 2 秒自动提交并推送；其他设备每 30 秒拉取一次。
4. Linux 或另一台 Mac 安装应用后，使用同一 GitHub SSH 账号即可自动接入。

Git 同步属于近实时同步：本机写入后立即推送，另一端最长约 30 秒看到变化。若两台设备同时修改同一篇论文导致 Git 冲突，应用会停止自动合并、保留本地内容并显示错误，而不会静默覆盖。

> GitHub 官方建议 HTTPS 用户使用 GitHub CLI 或 Git Credential Manager 保存凭据。Paper Vault 不读取或保存 token，而是复用系统 Git 的安全凭据。

## 数据目录

默认目录是系统“文稿”下的 `PaperVault`：

```text
PaperVault/
├── vault.json
├── README.md
├── categories/
│   └── vision-language-action/
│       ├── metadata.json
│       └── related-works.md
└── papers/
    └── 2406.12345/
        ├── metadata.json
        ├── notes.md
        ├── source.html
        ├── analysis.json
        ├── analysis.html
        ├── principle.png
        └── paper.pdf
```

`source.html` 优先归档 arXiv 官方 HTML，缺失时尝试 ar5iv；两者都不可用时，AI 解析会明确退化为摘要级分析。`principle.png` 只为 AI 判定的关键论文生成。

## AI 与密钥

- **ChatGPT 账号模式**：调用本机已经登录的 Codex，适合在个人 Mac/Linux 上直接使用；每台设备分别登录。
- **OpenAI API 模式**：API Key 使用 Electron `safeStorage` 进入系统钥匙串/安全存储，不写入论文库，也不会同步到 GitHub。
- GPT Image 2 属于 Image API，因此无论文本分析选择哪种模式，生成关键原理图都需要在本机保存 OpenAI API Key。

## 每日抓取

设置页可修改关键词、时间和每日上限（强制不超过 5 篇）。应用会注册开机启动并驻留系统托盘；到点后：

1. 查询 arXiv 最新候选论文并去重。
2. AI 按相关性、新颖性、潜在影响和实验可信度排序。
3. 导入最多 5 篇，记录 1–10 价值分与理由。
4. 建立 `每日精选 YYYY-MM-DD` 分类，并为论文生成主题分类。
5. 生成逐篇 HTML 解析，增量更新主题与每日分类的 Related Works。

若设备在 09:00 休眠或关机，应用会在当天下一次启动/唤醒后补跑一次。

PDF 会明显增大 Git 仓库。论文较多时，建议导入时取消“同时下载 PDF”，只同步元数据和笔记；或者自行在仓库中启用 Git LFS。

## 打包

```bash
npm run dist:mac
npm run dist:linux
```

生成的安装包位于 `dist/`。Linux 的 AppImage 可以直接运行，macOS 会生成 DMG 和 ZIP。

每次推送 `main` 后，GitHub Actions 也会自动运行测试，并分别生成 macOS DMG/ZIP 与 Linux AppImage/DEB，可在仓库 Actions 的构建产物中下载。

## 隐私与安全

- 默认没有云数据库，数据只位于你选择的本地目录和你的 GitHub 仓库。
- GitHub 凭据由 SSH agent、GitHub CLI 或系统 credential helper 管理，应用不保存 GitHub 访问令牌。
- OpenAI API Key 仅保存在当前设备的系统安全存储，不能通过 GitHub 同步。
- 渲染进程开启 context isolation 与 sandbox，并限制外部链接为 arXiv 域名。
