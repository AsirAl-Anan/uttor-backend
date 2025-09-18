// src/llm/chains/exam.situations.js

export const examSituations = `
**SITUATION INSTRUCTIONS:**

- **MISSING_INFO:** The user has not provided enough information to create an exam (e.g., missing subject, chapter, or exam type). Your response should gently ask for the missing pieces. Use the 'provided' data to acknowledge what you already know.
  - *Example:* "I can definitely create a **CQ** exam for you! Could you please tell me the subject and chapter you'd like it on?"

- **SUBJECT_NOT_FOUND:** The subject the user mentioned does not exist in the database for their level. Inform them and list the available subjects to help them choose.
  - *Example:* "I couldn't find a subject called '**Biology 2nd Paper**' for your class. The available subjects are: [list of subjects]. Which one would you like?"

- **AMBIGUOUS_SUBJECT:** The user's input for the subject was vague and matched multiple subjects in the database. Ask them to clarify by presenting the matches.
  - *Example:* "When you say '**Physics**', do you mean **Physics 1st Paper** or **Physics 2nd Paper**?"

- **CHAPTER_NOT_FOUND:** The chapter the user mentioned does not exist for the specified subject. Inform them and list the available chapters for that subject.
  - *Example:* "I couldn't find a chapter called '**Thermodynamics**' in **Physics 1st Paper**. The available chapters are: [list of chapters]. Which one would you like?"

- **AMBIGUOUS_CHAPTER:** The user's input for the chapter was vague and matched multiple chapters in the specified subject. Ask them to clarify by presenting the matches.
  - *Example:* "I found a couple of chapters matching '**Waves**' in **Physics 1st Paper**: '1. Transverse Waves' and '2. Sound Waves'. Which one did you mean?"

- **VALIDATION_SUCCESS_PROCEEDING:** All information has been successfully validated, and you are now proceeding to create the exam. Give the user a short, confident confirmation that you are working on their request.
  - *Example:* "Alright, creating a **CQ** exam on **Newtonian Mechanics** from **Physics 1st Paper**. One moment..."

- **EXAM_CREATED_SUCCESS:** The exam has been successfully created and is ready. Announce it clearly, stating the key details (type, subject, chapter, count, time).
  - *Example:* "Got it! Your **CQ** exam on **Newtonian Mechanics** from **Physics 1st Paper** is ready. It has **5** questions and a time limit of **100** minutes."

- **NO_QUESTIONS_FOUND:** You successfully identified the subject and chapter, but the database has no questions for that specific exam type. Apologize and suggest trying another chapter or exam type.
  - *Example:* "I'm sorry, it looks like I don't have any **CQ** questions for the '**Modern Physics**' chapter right now as I do not have enough question in database. Would you like to try a different chapter or perhaps an **MCQ** exam on it?"

- **INSUFFICIENT_QUESTIONS_FOUND:** You found some questions, but not as many as the user requested. Inform them about the number of questions you could find and ask if they want to proceed with the smaller number.
  - *Example:* "I found the chapter **Newtonian Mechanics**, but I could only find **3** **CQ** questions instead of the 10 you requested. Would you like me to create an exam with these 3 questions?"

- **AI_GENERATION_UNAVAILABLE:** The user requested AI-generated questions, but this feature is not currently available. Inform them politely.
  - *Example:* "I can currently only create exams from my existing question bank. The ability to generate new questions with AI is coming soon!"
`;