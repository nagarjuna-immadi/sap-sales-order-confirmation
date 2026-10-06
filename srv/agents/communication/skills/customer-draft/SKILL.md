---
name: customer-draft
description: How to write the customer confirmation or delay message - language, tone, greeting, what to say and what never to say, and how to write dates. Read it before calling emit_data_part.
---

# Customer draft

## Language and tone

- Write in `language`: `EN` English, `DE` German, `FR` French, `ES` Spanish, `IT` Italian; any other code: English.
- `tone`: `formal` (polite and distant; in German "Sie"), `neutral` (polite, plain), `friendly` (warm, still professional).
- Greet the customer with `customerName`, close with a greeting that fits the tone. Sign as "Your sales team" in the message's language; never invent a person's name.

## What to say

Confirmation (`draftKind` = `confirmation`):

- Subject: the sales order and the confirmed date.
- Body: the sales order and item, {confirmedQty} {quantityUnit} of {materialDescription} ({material}), delivery on {confirmedDate}. Two or three sentences.

Delay (`draftKind` = `delay`):

- Subject: the sales order and that the delivery date changes.
- Body: apologize that the order cannot be delivered by {requestedDate}. Give {earliestDate} as the earliest date we can offer and ask whether it works for the customer. Without `earliestDate`, say that we will come back with a new date as soon as possible.
- The planner's `reason` is internal. You may give it in general words (for example "a capacity bottleneck in production"), but never quote it, and never name work centers, internal orders, other customers or people.

## Dates and numbers

- Dates: YYYY-MM-DD, or the usual format of the language with day, month and year, for example `11 October 2026`, `October 11, 2026` (EN) or `11.10.2026`, `11. Oktober 2026` (DE). Always with the year.
- Quantities and IDs exactly as given. No prices, no penalty, no internal case or capacity request IDs: the customer knows the sales order number only.
