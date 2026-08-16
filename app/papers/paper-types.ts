export type Paragraph = {
  id: string;
  page: number;
  section: string;
  original: string;
  translation: string;
  note: string;
  bookmarked: boolean;
  read: boolean;
};

export type PaperRecord = {
  id: string;
  fileName: string;
  title: string;
  addedAt: number;
  updatedAt: number;
  activeParagraph: number;
  paragraphs: Paragraph[];
};

export type SearchPaper = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  abstract: string;
  citationCount: number;
  url: string;
  pdfUrl: string;
  doi: string;
  source: "Semantic Scholar" | "Crossref";
};

export const samplePaper: PaperRecord = {
  id: "sample-paper",
  fileName: "sample-statistical-learning.pdf",
  title: "Statistical learning in observational studies: principles and practice",
  addedAt: 1723766400000,
  updatedAt: 1723766400000,
  activeParagraph: 0,
  paragraphs: [
    {
      id: "sample-1",
      page: 1,
      section: "Abstract",
      original: "Statistical learning methods are widely used to identify patterns in complex observational data. Careful validation is essential because apparent predictive performance may not generalize to new populations.",
      translation: "统计学习方法被广泛用于识别复杂观察数据中的模式。谨慎的验证至关重要，因为表面上的预测性能可能无法推广到新的人群。",
      note: "",
      bookmarked: true,
      read: true,
    },
    {
      id: "sample-2",
      page: 2,
      section: "Methods",
      original: "The present study evaluates model performance using repeated ten-fold cross-validation. Discrimination was assessed with the area under the receiver operating characteristic curve and uncertainty was summarized using 95% confidence intervals.",
      translation: "本研究使用重复十折交叉验证评估模型性能。区分度采用受试者工作特征曲线下面积进行评价，并使用 95% 置信区间概括不确定性。",
      note: "重点检查是否存在数据泄漏。",
      bookmarked: false,
      read: false,
    },
    {
      id: "sample-3",
      page: 3,
      section: "Results",
      original: "The final model achieved an AUC of 0.78 (95% CI, 0.73 to 0.83). Performance was lower in the external validation cohort, suggesting moderate distribution shift.",
      translation: "最终模型的 AUC 为 0.78（95% CI：0.73～0.83）。在外部验证队列中，模型表现有所下降，提示存在中等程度的分布偏移。",
      note: "",
      bookmarked: false,
      read: false,
    },
  ],
};
