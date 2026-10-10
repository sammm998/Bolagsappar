-- Adminportalen: plattformen ändrar status på bokningar (arbetsdagar).
create policy "bokning ändra" on public.bookings for update using (app.is_platform()) with check (app.is_platform());
