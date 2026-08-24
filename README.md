# Pokopia 命定宝可梦测试

一个可公开分享的中文趣味测试：用户在 Pokopia 的真实道具中作选择，结果按宝可梦图鉴的喜好、理想环境、口味和专长进行匹配。

## 当前实现

- 15 组带图的同类物品题：花圃、座位、展示摆件、游戏室设备、树果、庭院景观、岛屿委托、工具架、派对装饰、店铺招牌、食品柜台、交通工具、床铺、珍奇展柜、灯具
- 每张卡都是实际存在的 Pokopia 道具；卡片下方显示它关联的图鉴字段，结果页逐项显示命中标签
- 可解释的加权匹配：喜好 35%、口味 20%、环境 20%、特长 25%；结果页逐项显示命中的同名图鉴标签
- Top 3 结果和分享文案
- 已接入 365 条结果：本篇 308、DLC 海底 52、活动 5；传说／幻之宝可梦与其他记录一样正常参与匹配
- 当前题库所用的道具图片随前端一起打包在 `app/assets/items/`，用户答题时不访问第三方图鉴站
- 题库覆盖公开图鉴中的全部 43 个喜好标签、5 种口味、6 类环境、31 项特长；`scripts/validate_question_coverage.py` 会在更新时检查这一点
- `data/pokemon.catalogue.json` 保留可审计的原始映射结果；`app/data/pokemon.generated.ts` 是网页实际使用的结果池

网页只读取项目内的生成数据，不会在用户答题时向第三方图鉴网站发请求。

如需刷新已选道具卡图片：

~~~powershell
python scripts/fetch_question_item_images.py --refresh
~~~

## 数据同步流程

1. 读取并刷新公开目录（目录内嵌了 365 条完整记录的名称、分区、属性、理想环境、特长与喜好）：

~~~powershell
python scripts/fetch_gamertw.py --refresh --limit 1
python scripts/import_catalogue.py
python scripts/validate_catalogue.py
python scripts/validate_question_coverage.py
~~~

2. 检查 `data/pokemon.catalogue.json` 中的数量、分区、名称、喜好、环境与特长；再检查每一个公开图鉴标签都至少有一张本地道具卡可供选择。

3. 如果要逐页留存详情页作人工抽查，可运行下面的可续跑抓取。默认保留 0.8 秒节流，不要放进前端或每次答题时重新抓取：

~~~powershell
python scripts/fetch_gamertw.py
python scripts/normalize_gamertw.py
~~~

4. 完成检查后再构建发布版：

~~~powershell
npm run build
~~~

来源页面属于各自站点。数据脚本保留来源 URL 和缓存文件，便于更新时复核；公开产品页须保留“非官方粉丝测试”说明。所有匹配和文案都是本项目生成的趣味表达，并非官方性格设定。
