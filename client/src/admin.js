import { createContext, useContext } from 'react';

// Whether the logged-in person is an admin. An admin can date a mortality and
// add photos from the gallery; the server checks it again on every request.
export const AdminContext = createContext(false);

export const useIsAdmin = () => useContext(AdminContext);

// Whether the logged-in person is one of those who approve mortality. What anyone
// else registers waits for them.
export const ApproverContext = createContext(false);

export const useIsApprover = () => useContext(ApproverContext);
