import React from 'react';

export default function BookMode({ text, renderWords }) {
  console.log('📚 BookMode рендерится с text:', text);

  // Проверяем наличие paragraphs
  if (!text?.paragraphs?.length) {
    console.warn('⚠️ Нет text.paragraphs, используем text.sentences');
    console.log('📄 text.sentences:', text?.sentences);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="prose dark:prose-invert max-w-none text-[20px] leading-9">
          {text?.sentences?.map((sentence, index) => {
            console.log(`📝 Предложение ${index}:`, sentence);
            const rendered = renderWords(sentence, index);
            console.log(`➡️ renderWords вернул для ${index}:`, rendered);
            return (
              <span
                key={index}
                id={`sentence-${index}`}
                data-sentence-index={index}
              >
                {rendered}{" "}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  console.log('📄 text.paragraphs:', text.paragraphs);
  let sentenceIndex = 0;

  return (
    <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="prose dark:prose-invert max-w-none text-[20px] leading-9 max-w-none">
        {text.paragraphs.map((paragraph, pIdx) => {
          console.log(`📃 Параграф ${pIdx}, предложений:`, paragraph.length);
          return (
            <p key={pIdx} className="mb-6">
              {paragraph.map((sentence) => {
                const currentIndex = sentenceIndex++;
                console.log(`📝 Предложение ${currentIndex} (параграф ${pIdx}):`, sentence);
                const rendered = renderWords(sentence, currentIndex);
                console.log(`➡️ renderWords вернул для ${currentIndex}:`, rendered);
                return (
                  <span
                    key={currentIndex}
                    id={`sentence-${currentIndex}`}
                    data-sentence-index={currentIndex}
                  >
                    {rendered}{" "}
                  </span>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}