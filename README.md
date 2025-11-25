zip → arcpkg 在线转换工具
==========================
https://jason4zh.github.io/ziptoarcpkg

简介
----
zip → arcpkg 是一款纯前端网页工具，可一键将 Arcade 谱面压缩包（.zip）转换成
ArcCreate 可直接读取的 .arcpkg 格式。支持批量上传、自动读取谱面数据、手动补充信息、
背景图处理等完整工作流，无需安装，打开即用。

主要功能
--------
- 批量转换：一次拖拽多个 ZIP，自动生成对应 .arcpkg
- 谱面数据自动识别：自动解析 slst.txt / songlist.txt、.aff 文件名、背景图
- 手动补全：缺失信息时弹出表单，可填写曲绘、谱师、BPM、难度数值
- 背景图处理：自动检测含 Background 的 JPG，也可手动上传或跳过
- 实时日志：彩色日志 + 进度条，报错一目了然
- 手动模式优化：支持用 ZIP 文件名作为包内文件夹名，方便管理
- 完全本地：所有处理在浏览器完成，文件不会上传服务器

支持的文件
----------
必需：
  base.jpg              曲绘
  base.ogg 或 base.mp3  音频
  0.aff ~ 4.aff         谱面

可选：
  *Background*.jpg      背景图
  slst.txt / songlist.txt  谱面数据（没有则进入手动模式）

使用流程
--------
1. 打开 https://jason4zh.github.io/ziptoarcpkg
2. 拖拽一个或多个 ZIP 到上传区域
3. 若缺少谱面数据，填写弹窗表单（曲绘、谱师、BPM、难度数值）
4. 选择背景图（可跳过）
5. 等待批量完成，点击下载 .arcpkg
6. 直接在 ArcCreate → 导入谱面包 导入即可游玩

技术栈
------
- 纯 HTML + CSS + JavaScript（ES6），无框架
- JSZip  - 解压 / 压缩
- js-yaml - 生成 project.arcproj
- Supabase（可选）- 统计转换次数
- PWA 支持（可离线使用）

常见问题
--------
Q1：日志提示“缺少 slst.txt”怎么办？
→ 工具会自动弹出手动表单，填完继续即可。

Q2：可以一次性转很多个文件吗？
→ 支持批量拖拽，进度条和日志会分别显示每个文件状态。

Q3：背景图必须吗？
→ 非必须，可跳过；若 ZIP 内包含 *Background*.jpg 会自动使用。

Q4：手动模式下文件夹名怎么定？
→ 已修复为使用 ZIP 文件名（不再是 manual_XXXX）。

Q5：转换失败怎么办？
→ 查看红色错误日志，常见原因：
   - 缺少 base.jpg / 音频
   - .aff 命名不规范（应为 0.aff ~ 4.aff）
   - JSON 格式损坏

开源协议
--------
MIT License · © 2025 Your Name  
欢迎 PR / Issue / Fork，一起让谱面分享更简单！

致谢
----
- ArcCreate 团队：提供优秀游戏框架
- JSZip & js-yaml：前端解压/解析核心库
- 社区谱师：源源不断的创意与谱面

链接
----
在线转换：https://jason4zh.github.io/ziptoarcpkg  
源码地址：https://github.com/jason4zh/ziptoarcpkg  

如果帮到你，给个 Star 支持一下哦 ~