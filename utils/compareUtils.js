function processDiff (original, altered) {
  let isSame = () => {
    if (original.length === altered.length) {
      for (let [i, value] of original.entries()) {
        if (altered.indexOf(value) === -1) {
          return false;
        }
      }
      return true;
    }
    return false;
  };

  let addedItems = () => {
    let items = [];
    for (let [i, value] of altered.entries()) {
      if (original.indexOf(value) === -1) {
        items.push(value);
      }
    }
    return items;
  };

  let removedItems = () => {
    let items = [];
    for (let [i, value] of original.entries()) {
      if (altered.indexOf(value) === -1) {
        items.push(value);
      }
    }
    return items;
  };
  return {
    isSame: isSame(),
    addedItems: addedItems(),
    removedItems: removedItems()
  };
};

export {
  processDiff
};