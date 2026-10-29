ALTER TABLE applications
  ADD COLUMN cover_letter text NOT NULL DEFAULT '' CHECK (length(cover_letter) <= 20000),
  ADD COLUMN application_address text NOT NULL DEFAULT '' CHECK (length(application_address) <= 2000),
  ADD COLUMN next_action text NOT NULL DEFAULT '' CHECK (length(next_action) <= 500);
