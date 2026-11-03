# F · Index

**In one line:** a warm paper desk with exactly one index card held on it per screen. Everything else is quiet type and hairlines, and the only colour is blue-black ink.

## The system ("Proprietary")
- **Palette.** Daylight (default): desk `#F2EEE6`, card `#FAF8F3`, held card `#FDFCF9`, hairlines `#DED7CA`/`#C4BBAA`, text `#25221D`/`#555047`/`#6B6458`. One ink, fountain-pen blue `#26428B`, used only for the primary action, E.V.'s mark (a pen dot) and her annotations. Status uses muted sage, ochre and brick, and appears only as 6 px dots or 2 px meters. Desk lamp (dark): a warm dark desk `#1C1915`, charcoal cards `#27241F`, ink `#A6B7EE` and a faint lamp glow. Every text pair passes 4.5:1 in both themes.
- **Type.** Three faces with three jobs. Newsreader is used for what is *written on a card* and for E.V.'s voice. Source Sans 3 is the interface. IBM Plex Mono is for numbers only. The five sizes: 26 card face · 20 titles/answers · 16 reading · 14 UI · 12 labels. Weights are 400/500.
- **Shape.** Every card is 5:3 with a 4 px radius, a 1 px border and a ruled header line, with its number set in the corner. Controls use a 2 px radius. Inputs are a ruled line, never a box.
- **Depth.** A resting card is a tone step plus a hairline. The held card gets the only soft lift. ⌘K floats. Nothing else casts a shadow.
- **Motion.** 120 hover, 160 lift, 200 flip, 240 deal, all on one curve. With reduced motion, every change is instant.
- **Icons.** Type and keys are the icons: ↵ ← → ↳ ○ ● and key caps. There are no pictograms.
- **Signature components.** The index card (front/back), the deck stack, the carousel stage, the Again/Good piles, the ruled answer line, the dashed proposal, the check card that slides under the note, and the ⌘K card.

## Why it fits Matt
- Low decision load: the held card *is* the next step. Today shows one card (the next block), and the rest of the day is a plain list.
- He stays in control: proposals are dashed and wait for Accept, the plan asks for confidence first, and Approve / Ask for changes / Put away sits on the proposal card.
- Precision reads as trust: hairlines, a mono for numbers, and a `↳ source` on every fact or a visible `○ unverified`.
- Calm under stress: warm paper, no badges, one ink. It is handmade-feeling, like a stack of cards in a science student's bag, with no textures or clip art.

## The carousel without being carousel-driven
- The deck rests as a neat **stack** in the Library. Only Study fans it out.
- Exactly one card is centred at 640 px. The neighbours are 82% size and 42% opacity, clipped at the stage edge, and show no controls. It is never a row of tiles.
- ← / → deal the next card. The answer line comes first: Space on an empty line gets a quiet nudge, and a second Space or "Just tell me" turns the card anyway.
- The back shows the answer, "You wrote …", E.V.'s ink note and the source. 1 / 2 sort the card onto the Again / Good piles, which show only as counts.

## A day in it
1. 8:40, between classes. Today holds one card, "Morning review", so he presses ↵.
2. Eight cards follow: he writes a guess, the card flips in 200 ms, and he sorts it with 2.
3. Lunch: in Notes he writes up Ch 9 with read-along running. E.V.'s check card slides under the page, and he answers in his own words.
4. In the evening he asks "is the mock exam ready?" She answers from the job, "18 of 40, about 20 min", with a link to Activity.
5. Library → Exams: he rates confidence, the plan drafts as a job, and he approves it on its card.

## Risks
- Cards can creep. The rule "one held card per screen" must be enforced in review, or it turns into a card wall. Rows stay plain.
- Fixed 5:3 cards limit content length: long answers or long questions need a "more" pattern, which is not designed yet.
- A serif for card content is a taste call. If Matt finds it too literary, Source Sans can take the face size without other changes.
- In five years: warm paper, hairlines and classic text faces have aged well for decades. The likeliest thing to date it is the carousel peek; it is kept small and could be dropped to a plain stack without redesign.

## Areas mapping and plan impact
- Areas are unchanged: **Today · Ask E.V. · Library (Decks, Practice, Weak spots, Exams + plan) · Notes (with sessions) · Progress (minimal) · Activity**. Skeleton: none.
- Shell: a **top bar** from `area.ts` replaces the sidebar (S-70). The running job and the "need you" count sit in the bar, and ⌘K opens a card.
- Kit (S-20…S-3x): new components are card, stack, pile, carousel stage, ruled input, check card, proposal, dot/meter, seg and palette card. Fonts are self-hosted (3 families).
- Type rule exception: 26 and 16 px are used only inside cards and notes. This needs a CONTRACT note against the 12/14/20 rule.
- Scope question: flashcard **decks with Again/Good rating** in Library. Decks can be sets of card items, and rating feeds the weak-spot scheduler (S-41…S-48). If decks are not in PLAN §8, they are an idea for Matt.
- Out of scope / not done: a long-card overflow pattern, the empty states and the phone.
