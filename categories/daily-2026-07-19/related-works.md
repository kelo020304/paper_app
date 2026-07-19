# 每日精选 2026-07-19 — Related Works

## 总览

本组工作围绕通用视觉—语言—动作（VLA）系统的五个互补问题展开：如何塑造继承多模态骨干后的动作表征，如何对生成式策略施加细粒度行为控制，如何以有限真实试验评估泛化，如何在持续学习中避免遗忘，以及如何将世界模型的预测能力转化为低延迟控制。共同趋势是：研究重心正从单纯扩大策略规模，转向表征稳定性、可控性、评测可信度、部署后适应与实时性。

## 通用 VLA、动作表征与行为可控性

RT-1、RT-2、PaLM-E、OpenVLA、π0/π0.5 等奠定了从大规模行为克隆、视觉语言知识迁移到离散或连续动作生成的主流路线。FAST、VQ-VLA、LAPA、UniVLA 与 RotVLA进一步从频域、量化、潜在动作或跨本体表示改善动作编码与迁移能力。这些方法主要讨论“以何种形式表示或生成动作”；Action QFormer 则关注动作监督如何经由跨模态接口反向塑造预训练视觉—语言表征。

在接口设计上，Perceiver、Flamingo 的重采样器、BLIP-2 的 Q-Former 与 InstructBLIP 都通过查询或潜变量瓶颈从视觉中选择信息。Action QFormer 延续这一思路，但先由指令条件化查询、再选择视觉证据，并把接口作为动作梯度的中介，直接缓解动作学习对上游多模态表征的重写和注意力漂移。相较 VEGA、DynaFLIP、HARP-VLA、LARA、AGRA 等面向空间、动力学或动作落地对齐的方法，其重点是动作监督引起的表征稳定性；其导航实验也不同于 ViKiNG、GNM、ViNT、NoMaD、LM-Nav、NaVid、Uni-NaVid、NavFoM 与 Navigation World Models 的显式规划、视频历史或世界模型路线，而是将零样本 sim-to-real 闭环导航作为稳定性的压力测试。

DiMaS 从另一个角度推进 VLA 表征研究：不是重构训练接口，而是在推理阶段干预流匹配 VLA 的内部状态，以控制机器人“如何”完成任务。语言模型和视觉语言模型中常见的线性方向 steering 在此失效：行为属性虽可被线性解码，却未必能由沿固定方向的平移可靠地驱动。DiMaS 因而在表征分布之间进行运输，而非施加固定向量偏移。它与 Action QFormer 形成互补：前者研究部署时的行为可操纵性及其跨任务迁移边界，后者研究训练时动作梯度如何保护和组织多模态表征；二者均表明，VLA 中“可读出”的行为特征不等于“可稳定控制”的行为机制。

## 通用策略的真实世界评测

LIBERO、CALVIN、Colosseum、VLABench、LIBERO-plus 以及关于泛化缺口分解的工作，通常通过任务集合、扰动或 OOD 条件揭示 VLA 的泛化弱点；Gao 等进一步归纳了通用操作策略的评测因素分类法。这一脉络主要回答“应测哪些能力”。Active Real-World Factor-Based Evaluation 则在给定人类可解释因素空间后，关注“在有限真实硬件预算下应优先测哪里”，并估计配置级性能分布，而非只给出单一成功率。

其方法与 Active Testing/Active Surrogate Estimators 同属贝叶斯主动评测，但机器人策略的动作输出与最终评测结果不同，代理模型只能依赖已获得的评测数据，不能直接复用策略训练示范。与最接近的 Efficient Evaluation of Multi-Task Robot Policies with Active Experiment Selection 相比，后者在仿真中面向多个“策略—任务”组合进行成本感知选择并采用 MDN+BALD；本文聚焦单一微调 π0 在真实硬件中的环境因素组合，采用严格的 100 次预算，并系统比较代理模型和采集函数。Contrast Sets、sim-real 混合评测与风险约束早停分别处理因素切换代价、不完美仿真和策略比较，与本文的全因素空间性能估计目标不同。

## 持续与终身 VLA 学习

EWC、LwF 与经验回放分别通过参数正则、输出蒸馏和情景记忆抑制遗忘；Progressive Networks、PackNet 则以扩展或隔离参数减少干扰。在冻结基础模型的参数高效适配设置中，LoRA、Prefix-Tuning、Prompt Tuning，以及 DualPrompt、CODA-Prompt 和 MoE-adapters 提供了提示、适配器和路由基础。

LifelongVLA 面向部署后按序获得机器人技能的场景，其关键不是提出新的通用动作骨干，而是把适配分成当前任务更新的短期 LoRA 与由回放/蒸馏维护的长期 LoRA，并按样本条件连续混合二者。相较直接缓存完整经验，它采用缓存前缀、重算后缀的随机扩散回放，以适应 VLA 的长时程控制和图像轨迹存储昂贵的约束。与 LwF-LoRA、ER、Info-VLA、AtomicVLA 等直接相关方法相比，其差异在于时间尺度分离的低秩适配、样本条件门控与轻量回放的组合；与 iManip、Never-Ending Behavior-Cloning Agent、ReMem-VLA 及预训练 VLA 抗遗忘研究共同构成持续机器人学习背景，但不应据此推断未直接实验比较的方法优劣。

## 世界模型辅助控制与实时策略

动作条件世界模型最初主要服务于可控未来视觉生成、仿真和数据扩增。Pandora、FreeAction 关注动作控制的视频生成，RoboTransfer、Cosmos-Transfer1 着重跨域迁移与 Sim2Real 数据，GigaWorld-0、Qwen-RobotWorld、Aether 则扩展了具身视频、3D/4D 表征及任务范围。GigaWorld-Policy-0.5 与这类“世界模型作为外部数据引擎”的路线不同：它将未来动态预测直接纳入策略训练，目标是把预测先验转化为可部署动作，而非仅合成额外数据。

在联合世界建模与控制的方向，UniPi 先生成未来视频再恢复动作；GR-2 将视频预训练与动作预测结合；VideoVLA、Motus、UWM、MotuBrain 则把未来观测和动作置于统一生成或预测框架。GigaWorld-Policy-0.5 保留未来视觉监督，但以因果掩码保证动作分支不能读取未来视觉，从而使动作成为独立、低时延的推理路径。

Mimic-video、LingBot-VA、S-VAM、DiT4DiT、LaWAM 等进一步尝试避免测试时显式像素级未来生成，分别以潜在视频计划、闭环预测、蒸馏表征、去噪中间特征或紧凑视觉子目标支持控制。GigaWorld-Policy 与 Fast-WAM 是最接近的训练时使用预测监督、测试时避免显式未来视频生成的方案。GigaWorld-Policy-0.5 在其 action-centered 因果结构上，通过视觉/动作专家分工减少 action-only 活跃计算，并采用 AC-WM+WAM 混合预训练及 AutoResearch 配方搜索；其实测的 85 ms RTX 4090 C++ 延迟体现了其面向边缘闭环部署的取向。