# Questions with known answers in the ingested documents, most taken from real
# queries in query_logs. The ground truth was found by searching the extracted
# text, not by running retrieval, so the set does not grade itself.
#
#   sources  file names that answer the question; any one counts
#   pages    PDF page numbers holding the answer; None accepts any page
#   expect   regexes the generated answer must all match (case-insensitive)
#   answerable=False  the documents do not cover this, the assistant should say so

PG_REGS = "UI_PG_Policies_and_Regulations.pdf"
PG_HANDBOOK = "handbook.pdf"
STUDENT_HANDBOOK = "FINAL_Student_Hand_Book.pdf"
CS_HANDBOOK = "STUDENT_INFORMATION_HAND_BOOK.pdf"
MANUAL_OF_STYLE = "MANUAL_OF_STYLE.pdf"
HARASSMENT_POLICY = "Sexual_Harassment.pdf"
GENDER_POLICY = "gender_policy.pdf"
UG_ADMISSION = "Undergraduate_Admission_Matters.pdf"

TEST_QUERIES = [
    # Postgraduate regulations
    {
        "question": "What is the pass mark for postgraduate courses?",
        "sources": [PG_REGS],
        "pages": [34],
        "expect": [r"40\s*%"],
    },
    {
        "question": "What score earns an A grade in postgraduate examinations?",
        "sources": [PG_REGS],
        "pages": [34],
        "expect": [r"70"],
    },
    {
        "question": "How are postgraduate courses numbered?",
        "sources": [PG_REGS],
        "pages": [32],
        "expect": [r"701"],
    },
    {
        "question": "What are the basic thesis supervision requirements?",
        "sources": [PG_REGS],
        "pages": [36],
        "expect": [r"supervis"],
    },
    {
        "question": "How do I complete postgraduate course registration?",
        "sources": [PG_HANDBOOK, PG_REGS],
        "pages": [45, 27, 29],
        "expect": [r"regist"],
    },
    # Thesis formatting
    {
        "question": "What is the maximum length of a thesis abstract?",
        "sources": [MANUAL_OF_STYLE, PG_REGS],
        "pages": [7, 38],
        "expect": [r"500"],
    },
    {
        "question": "What paper should my thesis be printed on?",
        "sources": [MANUAL_OF_STYLE, PG_REGS],
        "pages": [6, 41, 53],
        "expect": [r"80"],
    },
    {
        "question": "What font and line spacing should a thesis use?",
        "sources": [MANUAL_OF_STYLE, PG_REGS],
        "pages": [10, 41, 53],
        "expect": [r"Times New Roman"],
    },
    {
        "question": "How should photographs in a thesis be printed?",
        "sources": [MANUAL_OF_STYLE],
        "pages": [6],
        "expect": [r"glossy"],
    },
    # Postgraduate College handbook
    {
        "question": "Who is the Provost of the Postgraduate College?",
        "sources": [PG_HANDBOOK],
        "pages": [18, 39, 41],
        "expect": [r"Babalola"],
    },
    {
        "question": "What is the Postgraduate College hotline?",
        "sources": [PG_HANDBOOK],
        "pages": [38],
        "expect": [r"9090\s*561\s*432"],
    },
    {
        "question": "Where is the Old Sports Complex located?",
        "sources": [PG_HANDBOOK],
        "pages": [62],
        "expect": [r"Kenneth Dike"],
    },
    # University student handbook
    {
        "question": "How many halls of residence does the University have?",
        "sources": [STUDENT_HANDBOOK, PG_HANDBOOK],
        "pages": [81, 22],
        "expect": [r"twelve|12"],
    },
    {
        "question": "What makes me eligible to sit an examination?",
        "sources": [STUDENT_HANDBOOK, CS_HANDBOOK],
        "pages": [42, 13, 16],
        "expect": [r"75\s*%"],
    },
    {
        "question": "What does the university say about mode of dressing?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [66],
        "expect": [r"indecent|improper|reprimand|rustication"],
    },
    {
        "question": "What is the penalty for driving against traffic flow on campus?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [70],
        "expect": [r"5,?000"],
    },
    # Answers that sit in table cells
    {
        "question": "What is the fine for overloading passengers in a vehicle on campus?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [70],
        "expect": [r"2,?500"],
    },
    {
        "question": "What is the penalty for damaging University property like road signs?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [70],
        "expect": [r"10,?000"],
    },
    {
        "question": "What is the penalty for reckless driving on campus?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [63],
        "expect": [r"Disciplinary|Intra.?Campus"],
    },
    {
        "question": "How many units is CSC 103?",
        "sources": [CS_HANDBOOK],
        "pages": [19, 23, 26],
        "expect": [r"\b4\b"],
    },
    {
        "question": "Who was Head of the Computer Science Department from 1974 to 1988?",
        "sources": [CS_HANDBOOK],
        "pages": [5],
        "expect": [r"Longe"],
    },
    {
        # The President of Nigeria is the University's Visitor, listed in the handbook.
        "question": "Who is the president of Nigeria?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [26],
        "expect": [r"Tinubu"],
    },
    {
        "question": "When was University College Ibadan founded?",
        "sources": [STUDENT_HANDBOOK],
        "pages": [21],
        "expect": [r"1948"],
    },
    {
        "question": "What are the direct entry admission requirements?",
        "sources": [STUDENT_HANDBOOK, UG_ADMISSION],
        "pages": None,
        "expect": [r"level"],
    },
    {
        "question": "How is a matriculation number assigned to a new student?",
        "sources": [STUDENT_HANDBOOK, UG_ADMISSION],
        "pages": None,
        "expect": [r"matriculation"],
    },
    # Computer Science handbook
    {
        "question": "What is CSC 103 about?",
        "sources": [CS_HANDBOOK],
        "pages": [23, 26],
        "expect": [r"programming"],
    },
    {
        # Lowercase and unspaced, the way students often type course codes.
        "question": "what is csc475 about",
        "sources": [CS_HANDBOOK],
        "pages": [31],
        "expect": [r"ethic"],
    },
    {
        "question": "Who have been heads of the Department of Computer Science?",
        "sources": [CS_HANDBOOK],
        "pages": [5, 6],
        "expect": [r"Osofisan"],
    },
    # Policies
    {
        "question": "What are the penalties for sexual harassment?",
        "sources": [HARASSMENT_POLICY],
        "pages": None,
        "expect": [],
    },
    {
        "question": "How is a sexual harassment complaint investigated?",
        "sources": [HARASSMENT_POLICY],
        "pages": None,
        "expect": [r"investigat"],
    },
    {
        "question": "What does the Gender Mainstreaming Office do?",
        "sources": [GENDER_POLICY, HARASSMENT_POLICY],
        "pages": None,
        "expect": [r"gender"],
    },
    {
        "question": "What is the Distance Learning Centre?",
        "sources": [UG_ADMISSION, STUDENT_HANDBOOK],
        "pages": None,
        "expect": [r"distance"],
    },
    # Not covered by the documents
    {"question": "Who won the 2022 FIFA World Cup?", "answerable": False},
    {"question": "What is the tuition fee for a helicopter pilot licence?", "answerable": False},
    {"question": "What is the exchange rate of the naira to the dollar?", "answerable": False},
]
