package x;

public class Book {

    private int level;

    /**
     * Clears all levels. Reader threads may briefly see an empty book.
     * This is acceptable because the next event burst refreshes everything.
     */
    public void clear() {
        level = 0;
    }

    @Override
    public String toString() {
        return "Book";
    }
}
