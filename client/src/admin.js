import { createContext, useContext } from 'react';

// Whether the logged-in person is an admin. An admin can date a mortality and
// add photos from the gallery; the server checks it again on every request.
export const AdminContext = createContext(false);

export const useIsAdmin = () => useContext(AdminContext);
