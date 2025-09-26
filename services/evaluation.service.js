// evaluation.service.js

console.log(
  "--- EXECUTING LATEST V8 evaluation.service.js (WITH DEBUG LOGS) ---"
); // DEBUG LINE

import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs/promises";

// Your file imports
import { evaluatorLLM } from "../llm/geminiClient.js";
import CreativeQuestion from "../models/creativeQuestion.model.js";
import { CqResult, AnswerEvaluation } from "../models/cq.result.model.js";
import { EvaluationResultSchema } from "../schema/evaluation.schema.js";
import { uploadImage } from "../utils/cloudinary.js";

// --- NEW IMPORTS FOR AURA, ACTIVITY, AND RECOMMENDATIONS ---
import User from "../models/User.js";
import { UserActivity } from "../models/user.activity.model.js";
import { AuraTransaction } from "../models/auraTransaction.model.js";
import Recommendation from "../models/recommendation.model.js"; // Import Recommendation model
import Topic from "../models/topic.model.js"; // Import Topic model
// =======================================

// =============================================================
// ==      PART 1: SINGLE QUESTION EVALUATION SETUP           ==
// =============================================================

const singleQuestionParser = StructuredOutputParser.fromZodSchema(
  EvaluationResultSchema
);

const singleQuestionPromptTemplate = `You are a meticulous and systematic AI Exam Grader for the Bangladeshi SSC/HSC curriculum (NCTB). Your task is to evaluate a student's handwritten answer for a single question based on the provided images, model answers, and a strict set of grading rules.
**CRITICAL FORMATTING RULES:**
1.  **JSON LaTeX Escaping:** In all feedback strings, any backslash character \`\\\` MUST be properly escaped for JSON by doubling it. For example, to write "$v\\cos\\theta$", you must write it in the JSON string as "$v\\\\cos\\\\theta$".
2.  **Readability:** For clarity, use bullet points (starting with "- ") for listing deductions or multiple points. Use the literal string \`\\n\` to create new lines within feedback.
**Core Task:**
Your evaluation must be based purely on the text and diagrams in the student's answer script.
1.  **Read and Understand:** Carefully read the student's answer for each question part (A, B, C, D).
2.  **Compare and Evaluate:** Compare the student's response against the provided model answer.
3.  **Apply Grading Rules:** Apply the detailed grading rules below with precision.
4.  **Assign Marks:** Assign a numerical score for each part (A, B, C, D).
5.  **Provide Feedback:** For each part, write detailed, constructive textual feedback explaining EXACTLY why marks were deducted, following the feedback requirement.
---
### **DETAILED NCTB GRADING RULES**
You MUST follow these rules precisely for each corresponding part of the question.
**(a) Question – 1 Mark (Part A)**
- Award 1 mark for a correct and complete answer.
- Award 0 marks for an incorrect or irrelevant answer.
**(b) Question – 2 Marks (Part B)**
- Give full marks (2) if the student writes two paragraphs and correctly explains the answer.
- Deduct 0.5 marks if the student does not write two paragraphs.
- Deduct 0.5 marks if the student misses important information such as a definition or equation (if applicable).
**(c) Question – 3 Marks (Part C)**
- Deduct 0.5 marks if the student does not include the unit in the final answer.
- Deduct 0.5 marks if the student does not provide the final verdict/conclusion when required.
- Deduct 2 marks if the final calculated value is wrong but the formulas and process are correct.
**(d) Question – 4 Marks (Part D)**
- Deduct 0.5 marks if the student does not include the unit in the final answer.
- Deduct 0.5 marks if the student does not provide the final verdict/conclusion when required.
- Deduct 3 marks if the final calculated value is wrong but the formulas and process are correct.
### **Important Considerations**
- **Flexibility in Expression:** A student's way of answering may differ. As long as the explanation, logic, or calculation is correct and complete, award full marks even if the approach is different from the model answer.
### **Feedback Requirement**
When providing feedback for any deduction, you must explicitly state:
1.  The specific reason for each deduction, using bullet points for clarity.
2.  How many marks were deducted for each point.
**Example Feedback Format:** "- Deducted 0.5 marks for missing the final verdict.\\n- All calculations and formulas were correct."
---
**Question Details:**
Stem: {stem}
Part A: {questionA} (Marks: 1)
Part B: {questionB} (Marks: 2)
Part C: {questionC} (Marks: 3)
Part D: {questionD} (Marks: 4)
**Model Answers:**
Answer A: {answerA}
Answer B: {answerB}
Answer C: {answerC}
Answer D: {answerD}
{format_instructions}
The student has provided {image_count} images for their answer. Please begin your evaluation now.
**IMPORTANT:** Do not include any introductory text, concluding text, or any conversational filler. Your entire response must be ONLY the JSON object that adheres to the schema, enclosed in a single markdown code block.
`;

const singleQuestionPrompt = new PromptTemplate({
  template: singleQuestionPromptTemplate,
  inputVariables: [
    "stem",
    "questionA",
    "questionB",
    "questionC",
    "questionD",
    "answerA",
    "answerB",
    "answerC",
    "answerD",
    "image_count",
  ],
  partialVariables: {
    format_instructions: singleQuestionParser.getFormatInstructions(),
  },
});

// =============================================================
// ==      PART 2: OVERALL EXAM FEEDBACK & RECOMMENDATION SETUP ==
// =============================================================

const overallFeedbackParser = new StringOutputParser();

const topicAnalysisParser = StructuredOutputParser.fromZodSchema(
  z.object({
    search_terms: z
      .array(z.string())
      .describe(
        "A list of 3-5 specific, concise academic search terms based on the student's errors. e.g., ['Torque Calculation', 'Newton's Third Law', 'Ohm's Law']"
      ),
  })
);
const topicAnalysisPromptTemplate = `You are an AI Topic Analyst. Your job is to read a student's performance summary, identify the core academic concepts they struggled with, and generate a list of search terms to find relevant study materials.
**Instructions:**
1.  Analyze the provided 'Detailed Performance Summary'.
2.  Pinpoint the main topics, formulas, or concepts where the student lost marks.
3.  Generate a list of 3 to 5 concise, specific search terms that could be used to find textbook chapters or articles about these weak areas.
4.  Focus on the fundamental concepts, not just the specific details of the question.
**Example:**
- If the summary says "failed to apply the formula for torque correctly", a good search term would be "Torque and Angular Momentum".
- If the summary says "missed the definition of inertia", a good search term would be "Newton's First Law and Inertia".
{format_instructions}
**Detailed Performance Summary:**
{detailed_performance_summary}
**IMPORTANT:** Your response must ONLY be the JSON object. Do not include any other text.
`;
const topicAnalysisPrompt = new PromptTemplate({
  template: topicAnalysisPromptTemplate,
  inputVariables: ["detailed_performance_summary"],
  partialVariables: {
    format_instructions: topicAnalysisParser.getFormatInstructions(),
  },
});

const overallFeedbackPromptTemplate = `You are an expert AI Academic Tutor. Your role is to provide a structured, data-driven, and actionable "Overall Exam Report" for a student.
**CRITICAL FORMATTING RULES:**
1.  **LaTeX Escaping:** For any LaTeX math expression (e.g., formulas, Greek letters like $\\tau, \\Delta, \\omega$), you MUST escape the backslash. For example, to render $\\tau$, you must write it in the string as \`\\\\tau\`. This is essential for the JSON string to be parsed correctly.
2.  **Newlines:** To create a line break and separate elements like headers, paragraphs, and list items, you MUST use an actual newline character (\`\n\`). Do not use the literal string "\\n".
3.  **Bullet Points:** Start bullet points with \`- \` (a hyphen followed by a space). The renderer specifically requires this format.

**Your Task:**
Analyze the provided 'Detailed Performance Summary' and the 'Recommended Study Topics' list. Generate a report that strictly follows the four-part structure below, using the formatting rules.
---
**STRUCTURED REPORT FORMAT (MUST FOLLOW):**

**1. Key Issues Identified:**
Based on the entire exam, create a bulleted list of the 2-3 most significant recurring error patterns.
- Example: "Conceptual Misunderstanding: Struggled to apply the core principles of [Specific Topic]."

**2. Performance Breakdown by Topic:**
Briefly summarize the student's performance for each question's topic.
- **Topic: [Topic of Question 1]** - e.g., "Showed a good attempt at the formula (e.g., \`$\\\\tau = \\\\Delta L / \\\\Delta t$\`) but failed to interpret the initial conditions correctly."

**3. Actionable Recommendations (General Advice):**
Provide a numbered list of concrete steps for improvement.
1.  **Focus:** [Name the specific skill to improve, e.g., "Improving Problem Interpretation"]
    -   **Action:** [Describe a specific task, e.g., "For the next 5 practice problems, before solving, write down: 1) all given variables, 2) what needs to be found, and 3) the primary formula that connects them."]



**Instructions:**
Generate the "Overall Exam Report" now. Adhere strictly to the format and rules above. Do not add any introductory or concluding conversational text. Your entire response MUST BE a single string.
`;

const overallFeedbackPrompt = new PromptTemplate({
  template: overallFeedbackPromptTemplate,
  inputVariables: [
    "detailed_performance_summary",
    "recommended_topics_summary",
  ],
});

// =============================================================
// ==      PART 3: HELPER FUNCTIONS                           ==
// =============================================================

async function prepareImagesForLLM(imageFiles) {
  const imageParts = [];
  for (const file of imageFiles) {
    const buffer = await fs.readFile(file.path);
    const base64 = buffer.toString("base64");
    imageParts.push({
      type: "image_url",
      image_url: `data:${file.mimetype};base64,${base64}`,
    });
  }
  return imageParts;
}

function groupFilesByFieldname(files) {
  const grouped = {};
  files.forEach((file) => {
    const fieldname = file.fieldname;
    if (!grouped[fieldname]) {
      grouped[fieldname] = [];
    }
    grouped[fieldname].push(file);
  });
  return grouped;
}

// =============================================================
// ==      PART 4: SERVICE FUNCTIONS                          ==
// =============================================================
export async function evaluateAndSaveAnswer({
  userId,
  examId,
  questionId,
  originalImageFiles,
}) {
  if (!originalImageFiles || originalImageFiles.length === 0) {
    throw new Error(`No image files were provided for question ${questionId}.`);
  }
  try {
    const uploadPromises = originalImageFiles.map((file) =>
      uploadImage(file.path, { folder: `originals/${examId}` })
    );
    const [uploadResults, question] = await Promise.all([
      Promise.all(uploadPromises),
      CreativeQuestion.findById(questionId).lean(),
    ]);
    const originalImageUrls = uploadResults.map((result) => {
      if (!result.success)
        throw new Error(`Cloudinary upload failed: ${result.error}`);
      return result.data.url;
    });
    if (!question) throw new Error(`Question with ID ${questionId} not found`);
    const studentImageParts = await prepareImagesForLLM(originalImageFiles);
    const chain = evaluatorLLM.pipe(singleQuestionParser);
    const formattedPromptText = await singleQuestionPrompt.format({
      stem: question.stem,
      questionA: question.a,
      questionB: question.b,
      questionC: question.c,
      questionD: question.d,
      answerA: question.aAnswer,
      answerB: question.bAnswer,
      answerC: question.cAnswer,
      answerD: question.dAnswer,
      image_count: originalImageFiles.length,
    });
    const response = await chain.invoke({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: formattedPromptText },
            ...studentImageParts,
          ],
        },
      ],
    });
    const evaluation = new AnswerEvaluation({
      userId,
      examId,
      questionId,
      originalImages: originalImageUrls,
      marksA: response.marksA,
      marksB: response.marksB,
      marksC: response.marksC,
      marksD: response.marksD,
      feedbackA: response.feedbackA,
      feedbackB: response.feedbackB,
      feedbackC: response.feedbackC,
      feedbackD: response.feedbackD,
      handWriting: response.handWriting,
      feedback: response.overallFeedback,
      totalMarks: 10,
    });
    originalImageFiles.forEach((file) =>
      fs
        .unlink(file.path)
        .catch((err) =>
          console.error(`Failed to delete temp file: ${file.path}`, err)
        )
    );
    console.log(
      `✅ Evaluation generated successfully for question ${questionId}`
    );
    return evaluation;
  } catch (error) {
    console.error(
      `🚨 FAILED to evaluate question ${questionId} for user ${userId}. Error:`,
      error.message
    );
    originalImageFiles.forEach((file) =>
      fs
        .unlink(file.path)
        .catch((err) =>
          console.error(
            `Failed to delete temp file during error handling: ${file.path}`,
            err
          )
        )
    );
    throw new Error(
      `Evaluation failed for question ${questionId}: ${error.message}`
    );
  }
}

// In evaluation.service.js

export async function examEvaluate({ userId, examId, allImageFiles }) {
  console.log(
    `🚀 Starting full exam evaluation for exam: ${examId}, user: ${userId}`
  );

  await UserActivity.create({
    userId,
    activityType: "exam_submitted",
    details: {
      examId,
      examType: "cq",
      message: `Submitted CQ Exam for evaluation.`,
    },
  });

  const imagesByQuestionId = groupFilesByFieldname(allImageFiles);
  const questionIds = Object.keys(imagesByQuestionId);

  const resultDoc = new CqResult({
    examId,
    userId,
    status: "evaluating",
    answers: [],
  });
  await resultDoc.save();

  try {
    const evaluationPromises = questionIds.map((questionId) =>
      evaluateAndSaveAnswer({
        userId,
        examId,
        questionId,
        originalImageFiles: imagesByQuestionId[questionId],
      })
    );

    const evaluationOutcomes = await Promise.allSettled(evaluationPromises);

    const successfulEvaluations = [];
    const failedEvaluations = [];

    evaluationOutcomes.forEach((outcome, index) => {
      if (outcome.status === "fulfilled") {
        successfulEvaluations.push(outcome.value);
      } else {
        failedEvaluations.push({
          questionId: questionIds[index],
          reason: outcome.reason.message,
        });
      }
    });

    resultDoc.answers = successfulEvaluations;

    if (successfulEvaluations.length > 0) {
      const evaluatedQuestionIds = successfulEvaluations.map(
        (ans) => ans.questionId
      );
      const questions = await CreativeQuestion.find({
        _id: { $in: evaluatedQuestionIds },
      }).lean();
      const questionsMap = new Map(questions.map((q) => [q._id.toString(), q]));

      let detailedPerformanceSummary = successfulEvaluations
        .map((ans, i) => {
          const question = questionsMap.get(ans.questionId.toString());
          const questionTopic = question ? question.stem : "Unknown Topic";
          const errorDetails = [];
          if (ans.marksA < 1)
            errorDetails.push(
              `- Part A (Score: ${ans.marksA}/1): ${ans.feedbackA}`
            );
          if (ans.marksB < 2)
            errorDetails.push(
              `- Part B (Score: ${ans.marksB}/2): ${ans.feedbackB}`
            );
          if (ans.marksC < 3)
            errorDetails.push(
              `- Part C (Score: ${ans.marksC}/3): ${ans.feedbackC}`
            );
          if (ans.marksD < 4)
            errorDetails.push(
              `- Part D (Score: ${ans.marksD}/4): ${ans.feedbackD}`
            );
          return `\n-----------------------------------\nQuestion ${
            i + 1
          }\n- Topic/Stem: "${questionTopic}"\n- Marks Obtained: ${
            ans.marksObtained
          } out of ${ans.totalMarks}\n- Error Breakdown:\n${errorDetails.join(
            "\n"
          )}`;
        })
        .join("");

      let recommendedTopicsSummary =
        "No specific topics could be recommended at this time. Please review your results carefully.";

      try {
        console.log(
          "🧠 Analyzing performance to generate topic search terms..."
        );
        const analysisChain = evaluatorLLM.pipe(topicAnalysisParser);
        const analysisResult = await analysisChain.invoke({
          messages: [
            {
              role: "user",
              content: await topicAnalysisPrompt.format({
                detailed_performance_summary: detailedPerformanceSummary,
              }),
            },
          ],
        });

        const searchTerms = analysisResult.search_terms || [];
        console.log(`[DEBUG] AI generated search terms:`, searchTerms);

        if (searchTerms.length > 0) {
            
          // --- NEW, SMARTER QUERY LOGIC ---
          // 1. Extract all individual words from the AI's phrases.
          //    e.g., ['Impulse', 'and', 'Momentum', 'Definition', 'Periodic', 'Motion', ...]
          const keywords = searchTerms.flatMap(term => term.split(/\s+/));
          
          // 2. Filter out common, non-descriptive words (stopwords).
          const stopwords = new Set(['and', 'vs', 'the', 'of', 'from', 'a', 'in', 'is']);
          const uniqueKeywords = [...new Set(keywords.filter(kw => kw.length > 2 && !stopwords.has(kw.toLowerCase())))];
          
          console.log(`[DEBUG] Extracted unique keywords for search:`, uniqueKeywords);

          // 3. Create a single regex pattern that looks for ANY of these keywords.
          //    The pattern will be something like: /Impulse|Momentum|Periodic|Motion|Harmonic|.../i
          const searchRegex = new RegExp(uniqueKeywords.join('|'), 'i');

          // 4. Build a simpler, more effective query.
          const topicQuery = {
            $or: [
              { name: searchRegex },
              { tags: searchRegex },
              { "aliases.english": searchRegex },
              { "aliases.banglish": searchRegex },
              { "segments.title": searchRegex }, // Bonus: search inside topic segments
              { "segments.description": searchRegex }, // Bonus: search inside topic segments
            ],
          };
          // --- END OF NEW LOGIC ---

          console.log(`[DEBUG] Executing smarter MongoDB query with regex: /${searchRegex.source}/i`);

          const foundTopics = await Topic.find(topicQuery)
            .select("_id name")
            .limit(5)
            .lean();

          console.log(`[DEBUG] Topics found in database:`, foundTopics);

          if (foundTopics.length > 0) {
            console.log(
              `✅ Found ${foundTopics.length} relevant topics in the database.`
            );

            await Recommendation.findOneAndUpdate(
              { userId },
              {
                userId,
                $addToSet: {
                  recomendedTopics: { $each: foundTopics.map((t) => t._id) },
                },
              },
              { upsert: true, new: true }
            );
            console.log(`💾 Recommendation saved for user ${userId}.`);

            recommendedTopicsSummary = foundTopics
              .map(
                (topic) =>
                  `Topic: ${topic.name}, ID: {{${topic._id.toString()}}}`
              )
              .join("\n");
          } else {
            console.log(`⚠️ No topics found matching the AI's search terms.`);
          }
        } else {
          console.log(`⚠️ AI returned no search terms. Skipping topic search.`);
        }
      } catch (recommendationError) {
        console.error(
          "🚨 CRITICAL ERROR during recommendation generation:",
          recommendationError
        );
      }
      
      // ... (rest of the function is unchanged)
      const feedbackGenerationChain = evaluatorLLM.pipe(overallFeedbackParser);
      const overallFeedback = await feedbackGenerationChain.invoke({
        messages: [
          {
            role: "user",
            content: await overallFeedbackPrompt.format({
              detailed_performance_summary: detailedPerformanceSummary,
              recommended_topics_summary: recommendedTopicsSummary,
            }),
          },
        ],
      });

      resultDoc.feedback = overallFeedback;
    } else {
      resultDoc.feedback =
        "No questions could be successfully evaluated. Please review the submission.";
    }

    if (failedEvaluations.length > 0) {
      resultDoc.status = "review_required";
      resultDoc.errorMessage = `Failed to evaluate ${
        failedEvaluations.length
      } question(s). Details: ${JSON.stringify(failedEvaluations)}`;
      console.warn(
        `Evaluation for exam ${examId} completed with ${failedEvaluations.length} errors.`
      );
    } else {
      resultDoc.status = "evaluated";
      console.log(
        `✅ Full exam evaluation completed successfully for exam ${examId}.`
      );
      
      let totalMarksObtained = successfulEvaluations.reduce(
        (acc, ans) => acc + ans.marksObtained,
        0
      );
      let zeroMarkParts = successfulEvaluations.reduce((acc, ans) => {
        if (ans.marksA === 0) acc++;
        if (ans.marksB === 0) acc++;
        if (ans.marksC === 0) acc++;
        if (ans.marksD === 0) acc++;
        return acc;
      }, 0);

      const auraFromMarks = totalMarksObtained * 10;
      const auraFromZeros = zeroMarkParts * -5;
      const totalAuraChange = auraFromMarks + auraFromZeros;

      resultDoc.auraChange = totalAuraChange;

      if (totalAuraChange !== 0) {
        await User.findByIdAndUpdate(userId, {
          $inc: { aura: totalAuraChange },
        });
        await AuraTransaction.create({
          userId,
          points: totalAuraChange,
          source: { type: "cq_result", id: resultDoc._id },
          reason: `CQ Exam: ${totalMarksObtained} marks gained (+${auraFromMarks}), ${zeroMarkParts} zero-mark parts (${auraFromZeros}).`,
        });
        console.log(
          `Aura points updated for user ${userId} by ${totalAuraChange}.`
        );
      }
    }

    resultDoc.evaluatedAt = new Date();
    await resultDoc.save();
    return resultDoc;
  } catch (error) {
    console.error(
      `🚨 CATASTROPHIC FAILURE during exam evaluation for exam ${examId}. Error:`,
      error
    );
    resultDoc.status = "error";
    resultDoc.errorMessage = `A system error occurred: ${error.message}`;
    await resultDoc.save();
    throw error;
  }
}
