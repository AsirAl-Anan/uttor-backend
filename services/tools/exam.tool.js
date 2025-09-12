import mongoose from 'mongoose';
import McqExam from '../../models/mcq.exam.model.js';
import CreativeQuestion from '../../models/creativeQuestion.model.js';
import Subject from '../../models/subject.model.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';

const TIME_PER_MCQ_MIN = 1;
const TIME_PER_CQ_MIN = 20;

const calculateExamTime = (examType, questionCount) => {
  if (examType === 'MCQ') return questionCount * TIME_PER_MCQ_MIN;
  if (examType === 'CQ') return questionCount * TIME_PER_CQ_MIN;
  return 0;
};

const formatMissingItems = (items) => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items.pop();
  return `${items.join(', ')}, and ${last}`;
};

const handleCreateExam = async ({ parameters, userId }) => {
  const { exam_type, subject, chapter, question_count = 10, source = 'database' } = parameters;

  logger.info(`[Exam Tool] Initial request for ${exam_type} exam. Subject: ${subject}, Chapter: ${chapter}`);

  async function* resultStream() {
    try {
      // Step 1: Check if essential information is missing and ask for it.
      const requiredFields = {
        exam_type: 'the exam type (MCQ or CQ)',
        subject: 'the subject',
        chapter: 'the chapter',
      };
      const missingFields = Object.keys(requiredFields).filter(field => !parameters[field]);

      if (missingFields.length > 0) {
        const friendlyMissingNames = missingFields.map(field => requiredFields[field]);
        const formattedMissingText = formatMissingItems(friendlyMissingNames);
        let response = "";
        
        if (exam_type) response = `Okay, a ${exam_type} exam. Got it. `;
        else if (subject) response = `Okay, an exam on ${subject}. I can do that. `;
        else response = 'I can definitely create an exam for you. ';
        
        response += `To proceed, I just need to know ${formattedMissingText}.`;
        yield { text: response };
        return;
      }
      
      // Step 2: Get user context.
      const user = await User.findById(userId.userId);
      console.log("it  hello user nafisa",user)
      if (!user) {
        yield { text: "I'm sorry, I couldn't find your user profile to determine your academic level." };
        return;
      }
      
      // Step 3: Validate the subject. If not found, provide a helpful list.
      const subjectRegex = new RegExp(subject.trim(), 'i');
      const subjectDoc = await Subject.findOne({
        level: user.level,
        $or: [
          { englishName: subjectRegex },
          { banglaName: subjectRegex },
          { 'aliases.english': subjectRegex },
          { 'aliases.bangla': subjectRegex },
          { 'aliases.banglish': subjectRegex },
        ]
      });

      if (!subjectDoc) {
        const availableSubjects = await Subject.find({ level: user.level }, 'englishName');
        const subjectNames = availableSubjects.map(s => s.englishName).join(', ');
        const response = `I couldn't find a subject matching "${subject}". For your level (${user.level}), the available subjects are: ${subjectNames}. Please choose one.`;
        yield { text: response };
        return;
      }
      const canonicalSubjectName = subjectDoc.englishName;

      // ===================================================================
      // ===== START: NEW ROBUST CHAPTER VALIDATION LOGIC ================
      // ===================================================================

      // Step 4: Validate the chapter by name only. If not found, list available chapters.
      const chapterInput = chapter.trim();
      const chapterNameRegex = new RegExp(chapterInput, 'i');

      const matchedChapter = subjectDoc.chapters.find(chap => 
          chapterNameRegex.test(chap.englishName) || chapterNameRegex.test(chap.banglaName)
      );
      
      if (!matchedChapter) {
        // Format the list of available chapters for the found subject.
        const chapterNames = subjectDoc.chapters
          .map((chap, index) => `${index + 1}. ${chap.englishName}`)
          .join('\n');

        const response = `I found the subject for the text"${canonicalSubjectName}," but couldn't find a chapter matching "${chapterInput}". Here are the available chapters for this subject:\n\n${chapterNames}\n\nPlease choose a chapter from the list.`;
        yield { text: response };
        return;
      }
      const canonicalChapterName = matchedChapter.englishName;

      // ===================================================================
      // ===== END: NEW ROBUST CHAPTER VALIDATION LOGIC ==================
      // ===================================================================

      // Step 5: Proceed with exam creation using the validated, canonical names.
      let responseText = "";
      if (source === 'database') {
        const timeLimitInMinutes = calculateExamTime(exam_type, question_count);
        
        if (exam_type === 'MCQ') {
          const examData = {
              title: `MCQ Exam: ${canonicalSubjectName} - ${canonicalChapterName}`,
              level: user.level,
              subject: canonicalSubjectName,
              chapter: canonicalChapterName,
              totalMarks: question_count,
              timeLimitInMinutes,
              questions: [],
              creator: new mongoose.Types.ObjectId(userId.userId),
          };
          const newMcqExam = new McqExam(examData);
          await newMcqExam.save();
          responseText = `I have prepared a ${question_count}-question MCQ exam for you on **${canonicalSubjectName} - ${canonicalChapterName}**. It should take approximately **${timeLimitInMinutes} minutes** to complete. You can find it in your exams dashboard.`;
        
        } else if (exam_type === 'CQ') {
          logger.info(`[Exam Tool] Fetching ${question_count} CQs for Subject: ${canonicalSubjectName}, Chapter: ${canonicalChapterName}`);
          const questions = await CreativeQuestion.aggregate([
            { $match: { 'chapter.englishName': canonicalChapterName } },
            { $sample: { size: question_count } }
          ]);

          if (questions.length === 0) {
              yield { text: `I couldn't find any creative questions for **${canonicalSubjectName} - ${canonicalChapterName}**. Please try a different chapter.`};
              return;
          }
           if (questions.length < question_count) {
              yield { text: `I could only find ${questions.length} creative questions for **${canonicalSubjectName} - ${canonicalChapterName}**. I can create an exam with these if you'd like.`};
              return;
          }
          responseText = `I have prepared a ${question_count}-question Creative Question exam for you on **${canonicalSubjectName} - ${canonicalChapterName}**. It should take approximately **${timeLimitInMinutes} minutes** to complete. You can find it in your exams dashboard.`;
        
        } else {
           yield { text: "I can only create 'MCQ' or 'CQ' exams at the moment." };
           return;
        }
      } else {
        responseText = "Creating exams with AI-generated questions is a feature coming soon!";
      }

      yield { text: responseText };

    } catch (error) {
      logger.error('[Exam Tool] Error creating exam:', error);
      yield { text: "I'm sorry, I ran into a problem while creating the exam. Please try again later." };
    }
  }

  return resultStream();
};

export const examTool = {
  handleCreateExam,
};