# 周边小仓库

中文个人周边库存管理，适配手机。独立用户名密码、邀请码注册，每个账号拥有独立的云端库存、销售、分类和图片。支持成员数量、分批成本、部分售出、邮费分摊、整单撤销、图片备份及空仓库导入。

**GitHub 是代码和自动部署入口。GitHub Pages 无法运行账号和数据库接口，本项目部署到 Cloudflare Workers + D1 + R2。**

仓库只包含程序，不含任何个人库存、照片、密码、初始化密钥或数据库副本。请勿将备份上传到 GitHub。

## 首次上线

1. 注册并验证 [Cloudflare](https://dash.cloudflare.com/sign-up) 账号。
2. 在 Cloudflare 创建 D1 数据库 `merch-inventory`，记下 Database ID；创建 R2 存储桶 `merch-inventory-images`（保持私有）。如果平台提示开通服务、计费或付款方式，请自行确认所需方案。
3. 创建供 GitHub 部署使用的 Cloudflare API Token，限制到对应账号，授权 Workers Scripts Edit、D1 Edit、Workers R2 Storage Edit 和 Account Settings Read。不要发到聊天或写入代码。
4. 打开 GitHub 仓库 **Settings → Secrets and variables → Actions**：
   - Variables：`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_DATABASE_ID`。
   - Secrets：`CLOUDFLARE_API_TOKEN`、`ADMIN_SETUP_TOKEN`。
   - `ADMIN_SETUP_TOKEN` 使用密码管理器生成至少32位随机字符串，只由管理员保管，用于第一次创建管理员。
5. 在 **Actions → Test and deploy inventory → Run workflow** 启动部署。自动检查代码、执行数据库迁移、发布网站并设置初始化密钥；成功日志会显示 `workers.dev` 网址。没有配置账号和数据库时只执行检查，不部署。
6. 打开网址，输入管理员初始化密钥，设置自己的用户名和密码。完成后该初始化入口关闭。通过“我的账号 → 管理测试账号 / 邀请码”生成邀请码并发送给测试者。

以后推送到 `main` 会自动更新网站，数据库和图片保留。测试者只需要邀请码及自行设置的用户名密码，不需要 GitHub、Cloudflare 或 ChatGPT 账号。

## 原数据迁移

原网站与新网站是两份独立数据库，不会自动同步。

1. 在原网站点击“下载完整备份”，获得包含图片的 JSON 文件。
2. 登录新网站管理员账号，打开“我的账号 → 从旧仓库迁移”，选择文件并导入。
3. 导入仅允许空仓库且文件最大11MB，不覆盖已有记录。核对数量、成本和销售后，再统一使用新网址。
4. 保留原网站和下载的备份作为回退。此仓库没有包含任何人的原始数据。

## 账号与数据

- 每个邀请码7天内有效，只能注册一次；管理员可以撤销未使用的邀请码。
- 新用户从空白仓库开始。账号管理只显示昵称及状态，不显示其他人的库存。
- 停用会退出该账号所有设备，保留数据；重新启用后可以再次登录。
- 修改密码需要当前密码，并退出其他设备。暂不支持邮件找回，请保存到密码管理器。
- 云端记录按账号隔离，本地备份包含自己的图片和记录。
- 不要将 R2 存储桶设为公开，也不要将数据库或备份文件上传到代码仓库。

## 本地开发

需要 Node.js 22。

```sh
npm ci
npm run db:local
# 在本机 .dev.vars 中配置 ADMIN_SETUP_TOKEN，禁止提交此文件
npm run dev
npm test
npm run check
```

`wrangler.jsonc` 中的全零数据库ID仅供本地测试。GitHub部署时由环境变量生成真实配置，`wrangler.generated.json`不会提交。

## 费用与维护

使用量、套餐与计费由 Cloudflare 决定。上线前检查其控制台提示和额度。请定期下载备份。此版本适合个人收藏和小规模邀请测试，暂不提供自助密码找回、删除账号或离线编辑。

参考：[Cloudflare Workers 静态资源与API](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)、[D1迁移](https://developers.cloudflare.com/d1/reference/migrations/)。
