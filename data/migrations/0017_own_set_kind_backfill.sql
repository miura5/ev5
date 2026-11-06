-- The user's own sets get their own kind (§data.additive): 0008 stored them as 'adhoc', which is for the questions a
-- note or chat holds. Plain equality on the writer, so a second run changes nothing.
UPDATE sets SET kind = 'own' WHERE kind = 'adhoc' AND created_by = 'user';
