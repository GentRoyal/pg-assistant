import fitz

pdf_path = r"C:\Users\USER\Desktop\PG Assistant\data\MANUAL_OF_STYLE.pdf"


pdf = fitz.open(pdf_path)

text = ""
for page_number, page in enumerate(pdf):
    text = page.get_text()
    print(text)

    if page == 5:
        break

pdf.close()