export interface SurveyTopic {
    id: string;
    category: 'academic' | 'behavioral' | 'routine';
    title: string;
    prompt: string;
    followUpTriggers: string[];
}
export declare const SURVEY_TOPICS: SurveyTopic[];
//# sourceMappingURL=surveyQuestionBank.d.ts.map