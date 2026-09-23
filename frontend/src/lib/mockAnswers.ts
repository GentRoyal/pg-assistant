import type { AskResponse } from '../types'

const LIBRARY: Array<{
  keywords: string[]
  answer: string
  sources: AskResponse['sources']
  confidence: number
}> = [
  {
    keywords: ['registration', 'register', 'enrol', 'enroll'],
    answer:
      "For postgraduate registration at the University of Ibadan, you typically complete online course registration within the published window for your session, pay the required fees, and obtain departmental and postgraduate school clearance where applicable.\n\nIf a course does not appear, check with your department that it has been mounted for the session, then revisit the portal. Always confirm deadlines on the current session circular—dates change yearly.\n\nI'm here as a friendly guide based on the regulation documents in this system. For official clearance, follow your faculty/PG school instructions.",
    sources: [
      {
        document_title: 'Postgraduate Handbook',
        section: 'Registration Procedures',
        page: 18,
        chunk_text:
          'All postgraduate students shall complete registration of courses within the period prescribed by the University for each academic session.',
        score: 0.91,
      },
      {
        document_title: 'Postgraduate Handbook',
        section: 'Payment of Fees',
        page: 21,
        chunk_text:
          'Registration shall not be regarded as complete until prescribed fees have been paid and necessary clearances obtained.',
        score: 0.86,
      },
    ],
    confidence: 0.88,
  },
  {
    keywords: ['exam', 'examination', 'resit', 're-sit'],
    answer:
      "Examination rules for postgraduate programmes usually require you to be duly registered for the course, satisfy continuous assessment requirements where applicable, and sit the exam at the scheduled time and venue.\n\nAbsence without approved reason can lead to a fail or incomplete grade. If you need a make-up or special consideration, apply through the proper departmental/faculty channel early and keep written approval.\n\nThis summary is drawn from the regulation excerpts retrieved for your question—check the sources below for the exact wording.",
    sources: [
      {
        document_title: 'Examination Regulations',
        section: 'Eligibility to Sit Examinations',
        page: 7,
        chunk_text:
          'A candidate shall be eligible to sit an examination only if the candidate has been duly registered for the course and has fulfilled other prescribed conditions.',
        score: 0.89,
      },
    ],
    confidence: 0.84,
  },
  {
    keywords: ['thesis', 'dissertation', 'defence', 'defense', 'supervisor'],
    answer:
      "For thesis/dissertation work, you are expected to work under an approved supervisor (or supervisory committee), meet departmental progress milestones, and submit according to the format and timeline set by the Postgraduate College.\n\nBefore defence, ensure your abstract, plagiarism checks, and soft-bound submission requirements are complete as stated in the current PG guidelines.\n\nIf your question is about a specific Faculty rule, tell me the programme (e.g. M.Sc., Ph.D.) and I can try to narrow the retrieved sections.",
    sources: [
      {
        document_title: 'Postgraduate Handbook',
        section: 'Thesis and Dissertation',
        page: 44,
        chunk_text:
          'Every candidate for a research degree shall prepare a thesis or dissertation under the supervision of a supervisor or supervisory committee appointed by the appropriate Board.',
        score: 0.9,
      },
    ],
    confidence: 0.82,
  },
]

function fallback(question: string): AskResponse {
  return {
    answer: `I searched the academic regulation knowledge base for “${question.trim()}”, but I could not find a clear supporting section in the current documents.\n\nTry rephrasing with programme level (PGD, Master's, Ph.D.), the topic (registration, exams, fees, thesis), or a document name. I will only answer when the regulations support it—so you can trust what you see here.`,
    sources: [],
    confidence: 0.2,
  }
}

export async function mockAsk(question: string): Promise<AskResponse> {
  await new Promise((r) => setTimeout(r, 700 + Math.random() * 500))
  const q = question.toLowerCase()
  const hit = LIBRARY.find((item) => item.keywords.some((k) => q.includes(k)))
  if (!hit) return fallback(question)
  return {
    answer: hit.answer,
    sources: hit.sources,
    confidence: hit.confidence,
  }
}
