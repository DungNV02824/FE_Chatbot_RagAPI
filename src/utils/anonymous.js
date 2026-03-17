export const getAnonymousId = () => {
  let id = localStorage.getItem("anonymousId");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("anonymousId", id);
  }

  return id;
};