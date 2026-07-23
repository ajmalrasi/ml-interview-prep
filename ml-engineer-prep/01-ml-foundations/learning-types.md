# Learning Types & Algorithms

**TL;DR:** Three families — **supervised** (learn from labeled examples),
**unsupervised** (find structure in unlabeled data), and **reinforcement** (learn
from reward). Know which real problems fall into each, plus a short list of go-to
algorithms and when to reach for them.

## Supervised learning

You have inputs *and* the correct answers (labels), and the model learns to map one
to the other. It splits into two tasks: **classification** predicts a category (spam
or not, which of 10 classes), and **regression** predicts a number (price, demand,
temperature). This is the bulk of applied ML because most business problems come with
historical labeled outcomes — past purchases, past churn, past fraud.

## Unsupervised learning

No labels — you're looking for structure the data already has. **Clustering** groups
similar items (customer segments, anomaly-free vs anomalous behavior); **dimensionality
reduction** (PCA, embeddings) compresses many features into a few while keeping the
signal, useful for visualization and as input to other models. You reach for this when
you don't have labels, or to *explore* data before modeling.

## Reinforcement learning

An agent takes actions in an environment and learns from a **reward** signal — think
game-playing, robotics, or ad/recommendation policies that optimize long-term
engagement. It's powerful but data-hungry and finicky, so in most product ML jobs it's
a "know the concept" topic rather than a daily tool. Note that **RLHF** (reinforcement
learning from human feedback) is how LLMs are aligned (section 9), so it's worth
recognizing.

## The algorithms worth knowing cold

You don't need dozens — you need to defend a few and know their trade-offs:

| Algorithm | Use it for | Why |
|---|---|---|
| **Linear / Logistic regression** | baselines, interpretable problems | fast, explainable — always start here |
| **Decision trees** | simple non-linear splits | interpretable but overfit alone |
| **Random Forest** | tabular, robust default | bagging → low variance, little tuning |
| **Gradient boosting (XGBoost/LightGBM)** | tabular winner | usually best on structured data |
| **k-Means** | clustering | simple, fast segmentation |
| **Neural networks** | images, text, audio, huge data | learn features; overkill for small tabular |

## The one line interviewers want

*"For structured/tabular data I start with a boosted-tree model like XGBoost — it's the
strongest default. I only reach for deep learning when I have unstructured data
(images, text) or very large datasets where learned features beat hand-crafted ones."*
That single sentence signals real-world judgment over hype.

## 🔗 Connecting the dots: the real stack

Each family has a go-to library: **scikit-learn** for classical models, **XGBoost / LightGBM** for boosting, **PyTorch** and **TensorFlow/Keras** for deep learning, and **HuggingFace** for pretrained text/vision models. Reinforcement learning uses **RLlib** or **Stable-Baselines3**; RLHF for LLMs uses **TRL**.

**How you'd say it:** *"For tabular I reach for XGBoost via scikit-learn; for anything unstructured I start from a pretrained PyTorch model on HuggingFace and fine-tune."*

## Self-check

- Classification vs regression? *(predict a category vs a number.)*
- No labels — which family, and give one technique? *(unsupervised; clustering or PCA.)*
- Best default for tabular data, and when do you switch to neural nets? *(gradient
  boosting; switch for unstructured data or very large scale.)*
