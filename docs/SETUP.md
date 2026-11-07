# My Open Source Lab 使用说明

这是一份 GitHub Profile README。标题、进度条和每张任务卡片都是仓库内生成的 SVG，卡片外面的 HTML 链接负责跳转。无需服务器、第三方图床或 npm 依赖。README 中不能直接切换任务状态；在 GitHub Issues 中更新。

## 本地查看

需要 Node.js 18 或更高版本；Actions 使用 Node.js 22。

```sh
npm run build
npm test
npm run preview
```

打开终端输出的本地地址。预览复用 README 中的 `<picture>` 和卡片链接，模拟 GitHub 的宽度与图片间距；提供浅色、深色与手机预览。GitHub 实际展示以发布后的 README 为准。

## 让它显示在个人主页

GitHub 要求公开仓库与用户名同名，且根目录包含非空 `README.md`，才能显示为个人主页。

1. 将仓库名改为 `Keikeikm`，或将这些文件放入公开的 `Keikeikm/Keikeikm` 仓库。
2. 将 `roadmap/config.json` 的 `repository` 改为 `Keikeikm/Keikeikm`，并更新本地 Git remote。
3. 运行 `npm run build`，提交并推送文件。Actions 内会自动使用实际的 `GITHUB_REPOSITORY`，因此仓库改名后远程同步仍会生成正确的 Issue 链接。

当前实现没有重命名远程仓库，也没有提交或推送本地改动。

参考：[GitHub Profile README 要求](https://docs.github.com/en/account-and-profile/how-tos/profile-customization/managing-your-profile-readme)。

## 替换示例数据

默认 `source` 为 `demo`，显示截图风格的五个示例项目，页脚和图片替代文本均标明为示例。点击卡片会进入示例说明，不会指向虚构仓库。

可以直接编辑 `roadmap/examples.json`，每个项目包括：

```json
{
  "id": "my-project",
  "title": "Build something useful",
  "focus": "TypeScript · Developer Tools",
  "status": "in-progress",
  "url": "https://github.com/owner/project"
}
```

`id` 必须唯一，只能包含字母、数字、下划线和短横线。状态为 `planned`、`in-progress`、`completed`。链接必须使用 HTTPS；示例模式未填链接时指向 `docs/EXAMPLES.md` 中同名锚点，添加自己的示例时也应补上对应锚点或项目链接。完成编辑后运行 `npm run build`。

## 启用 Issues 自动同步

1. 在仓库中创建 `roadmap` 和 `in progress` 两个标签，名称也可通过配置文件调整。
2. 使用 **New issue → Open-source project** 表单创建真实计划。Issue 标题为项目名；Technical focus 为技术方向；Project link 可选，留空则卡片跳转该 Issue。
3. 给要展示的 Issue 手动添加 `roadmap` 标签。表单不会自动添加该标签，访客的建议不会自动成为你的公开计划。
4. 将 `roadmap/config.json` 中的 `source` 从 `demo` 改为 `github`，提交并推送到默认分支。
5. 在 **Actions → Update open source roadmap** 查看运行结果，也可以用 **Run workflow** 手动刷新。

| Issue 状态 | 首页效果 |
| --- | --- |
| Open + `roadmap` | 空心圆、计划中 |
| Open + `roadmap` + `in progress` | 琥珀色状态点、进行中 |
| Closed as completed + `roadmap` | 勾选、删除线、计入完成数 |
| Reopened | 恢复未完成；有 `in progress` 则恢复进行中 |
| Closed as not planned | 从路线图及完成统计中移除 |
| 移除 `roadmap`、删除或移走 Issue | 移除卡片 |

条目按 Issue 编号从小到大排列；进度为已完成项目数 / 当前展示的项目数。Issue 正文里的子任务复选框不单独计入总进度，发布完成后关闭整个 Issue。没有项目时显示空状态和 `0 / 0 completed`，不会恢复示例项目。

Issues 创建、编辑、关闭、重开、标签变化、删除和转移会触发更新；每天另有一次校准。标签重命名后，应同步修改配置中的标签名。同步只读取当前仓库带指定标签的 Issues，会排除 Pull Requests 并处理分页。Project link 只是跳转地址，不会读取另一个仓库的状态。

Actions 使用自带的 `GITHUB_TOKEN`（`contents: write`、`issues: read`），无需配置个人 Token。仓库需要允许 GitHub Actions 运行；如果默认分支设置了保护规则，需要允许该工作流写入，或调整为你自己的 PR 审核流程。写入冲突不会强制覆盖远程改动，可以在处理后重新运行。

本地拉取公开 Issues 可直接运行 `npm run sync`。如遇 API 限流，可以通过环境变量提供 `GITHUB_TOKEN`。请求失败时返回非零状态，不会用空数据覆盖原卡片。

参考：[Actions 事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)、[Issues API](https://docs.github.com/en/rest/issues/issues#list-repository-issues)。

## 自定义与生成文件

- `roadmap/config.json`：标题、描述、角标、标签名、仓库和数据源；路线图标题不包含固定年份。
- `roadmap/examples.json`：示例数据。
- `roadmap/issues.json`：Issues 同步后的缓存，可离线重新生成。
- `assets/roadmap/`：自动生成的 SVG，包含浅色/深色与桌面/手机版；不要手动编辑，生成器会清理移除的项目图片。
- `README.md`：只替换 `ROADMAP:START` 和 `ROADMAP:END` 之间的内容，可在标记外添加个人介绍。

内容哈希会加入图片 URL，在图片改变时更新地址以帮助缓存刷新。SVG 不包含脚本或内嵌网页，文字已转义，移动端长标题和中英文文本会自动换行。深色版本通过 `<picture>` 的 `prefers-color-scheme` 选择。
