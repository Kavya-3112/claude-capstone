# Project Input — Contact Management System User Stories

## US-01: Add a New Contact

**As a** user,  
**I want** to add a new contact with a name and phone number,  
**So that** I can store people's contact information in one place.

**Acceptance Criteria**
- Users can add a contact by entering a name and phone number.
- The system validates that required fields are provided.
- Phone numbers must contain 7–15 digits after removing permitted formatting characters.
- Phone numbers may include a leading `+`, spaces, hyphens, and parentheses.
- Phone numbers containing letters or extensions are rejected.
- The system displays a clear validation message when the input is invalid.
- A successfully added contact appears in the contact list.
- Newly created contacts appear before older contacts.

## US-02: View All Contacts

**As a** user,  
**I want** to view all my saved contacts,  
**So that** I can quickly access their information.

**Acceptance Criteria**
- The system displays the saved contacts in a contact list.
- Each contact displays its name and phone number.
- The newest contacts appear first.
- The system displays an appropriate empty state when no contacts exist.
- Contacts remain available after refreshing the browser.
- Contact information is displayed clearly on desktop and mobile screens.

## US-03: Edit an Existing Contact

**As a** user,  
**I want** to update a contact's name or phone number,  
**So that** I can keep my contact information accurate.

**Acceptance Criteria**
- Users can select an existing contact for editing.
- The edit form displays the contact's currently saved details.
- Users can update the name and phone number.
- The system validates the updated information before saving.
- Invalid changes are rejected with a clear error message.
- Users can cancel editing without changing the saved contact details.
- Successfully edited contacts retain their existing position in the list.

## US-04: Delete a Contact

**As a** user,  
**I want** to delete a contact that I no longer need,  
**So that** I can keep my contact list organized.

**Acceptance Criteria**
- Users can select a contact for deletion.
- The system requests confirmation before permanently deleting a contact.
- Confirmed deletion removes the selected contact from the list.
- Cancelling the deletion preserves the contact.
- Deleting one contact does not affect other contacts.
- The system displays an appropriate empty state when the last contact is deleted.

## US-05: Search Contacts by Name or Phone Number

**As a** user,  
**I want** to search for contacts using their names or phone numbers,  
**So that** I can find a particular contact quickly.

**Acceptance Criteria**
- Users can search contacts by name.
- Users can search contacts using a full or partial phone number.
- Name searches are case-insensitive.
- Phone searches ignore permitted formatting differences such as spaces, hyphens, and parentheses.
- Search results update to reflect the entered query.
- The system displays a helpful message when no contacts match the search.
- Clearing the search restores the full contact list.

## US-06: Allow Contacts with Duplicate Phone Numbers

**As a** user,  
**I want** to save different contacts even when they share the same phone number,  
**So that** I can maintain accurate records for family members, colleagues, or shared numbers.

**Acceptance Criteria**
- The system permits multiple contacts with the same phone number.
- Each contact has a unique internal identifier.
- Editing or deleting one contact affects only that selected contact.
- Contacts with identical phone numbers remain individually searchable and accessible.
- The system does not mistakenly treat a phone number as a unique contact identifier.

## US-07: Preserve Contacts and Recover from Storage Errors

**As a** user,  
**I want** my saved contacts to persist and be protected from storage failures,  
**So that** I do not lose my contact information unexpectedly.

**Acceptance Criteria**
- Contacts are stored using browser local storage.
- Saved contacts remain available after refreshing or reopening the browser, provided the same browser storage is retained.
- The system validates stored contact data before using it.
- If stored data is unreadable, the system attempts recovery without immediately overwriting the original data.
- Replacing unreadable stored data requires explicit user confirmation.
- If saving changes fails, the current visible changes remain available in the interface and the system clearly indicates that the changes are not saved.
- The system does not falsely indicate that a failed save was successful.

## US-08: Use the Contact Management System Accessibly

**As a** user,  
**I want** to operate the contact management system using accessible controls and responsive layouts,  
**So that** I can manage contacts across supported devices and input methods.

**Acceptance Criteria**
- The application supports a minimum viewport width of 320 CSS pixels without unintended horizontal scrolling.
- All interactive features are operable using a keyboard.
- Form fields have accessible labels and validation messages.
- Keyboard focus is visible and follows a logical order.
- Dynamic updates and error messages are communicated appropriately to assistive technologies.
- Text and interactive controls meet applicable WCAG 2.2 AA requirements.
- The interface is assessed using appropriate automated accessibility checks and manual keyboard and screen-reader testing.
- Accessibility conformance is reported only after the required assessments have been completed.

---

